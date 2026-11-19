"""Server-side chat for LogicX planning and coding workspaces."""

import json
import os
from urllib.error import URLError
from urllib.request import Request, urlopen

import frappe

from logicx_app.api import check_app_permission


INSTRUCTIONS = {
	"planning": (
		"You help plan garments manufacturing in LogicX, a Frappe and ERPNext app. "
		"Cover fabric receipt and inspection, cutting, stitching, finishing, packing, and dispatch. "
		"Identify affected records, handoffs, exceptions and acceptance criteria. "
		"Distinguish proposed workflows from existing features and ask about missing requirements."
	),
	"coding": (
		"You help plan and draft changes for LogicX, a Frappe and ERPNext app with a React/Vite frontend. "
		"Propose concrete implementation steps, data model changes, and tests as appropriate. "
		"Use only the code and requirements supplied in the conversation. "
		"State when you need source context and never claim to have edited files or run commands."
	),
}


@frappe.whitelist(methods=["POST"])
def reply(mode: str, messages: list) -> dict:
	if frappe.session.user == "Guest" or not check_app_permission():
		frappe.throw("You do not have access to LogicX chat.", frappe.PermissionError)
	if not isinstance(mode, str) or mode not in INSTRUCTIONS:
		frappe.throw("Choose a valid chat workspace.")
	if mode == "coding" and frappe.session.user != "Administrator":
		frappe.throw("Agentic Coding requires Administrator access.", frappe.PermissionError)

	conversation = validate_messages(messages)
	api_key = os.environ.get("OPENAI_API_KEY") or frappe.conf.get("logicx_openai_api_key")
	model = os.environ.get("LOGICX_OPENAI_MODEL") or frappe.conf.get("logicx_openai_model")
	if not api_key or not model:
		frappe.throw("Agent chat is not configured. Ask an administrator to set the server's OpenAI API key and model.")

	request = Request(
		"https://api.openai.com/v1/responses",
		data=json.dumps({
			"model": model,
			"instructions": INSTRUCTIONS[mode],
			"input": conversation,
			"max_output_tokens": 2000,
			"store": False,
		}).encode(),
		headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
		method="POST",
	)
	try:
		with urlopen(request, timeout=45) as response:
			result = json.load(response)
	except (URLError, TimeoutError, ValueError):
		frappe.throw("The agent provider could not complete this request. Try again or check the server configuration.")

	parts = [
		part.get("text") or part.get("refusal")
		for item in result.get("output", [])
		if item.get("type") == "message"
		for part in item.get("content", [])
		if part.get("type") in {"output_text", "refusal"}
	]
	answer = "\n".join(part for part in parts if part).strip()
	if not answer:
		frappe.throw("The agent returned no text. Try a shorter request.")
	return {"text": answer}


def validate_messages(messages):
	if not isinstance(messages, list) or not 1 <= len(messages) <= 12:
		frappe.throw("Send between 1 and 12 chat messages.")

	conversation = []
	for index, message in enumerate(messages):
		expected_role = "assistant" if index % 2 else "user"
		if not isinstance(message, dict) or message.get("role") != expected_role:
			frappe.throw("Invalid chat message order.")
		content = message.get("content")
		if not isinstance(content, str) or not content.strip() or len(content) > 6000:
			frappe.throw("Chat messages must contain between 1 and 6,000 characters.")
		conversation.append({"role": expected_role, "content": content.strip()})
	if conversation[-1]["role"] != "user":
		frappe.throw("The last chat message must be a user message.")
	return conversation
