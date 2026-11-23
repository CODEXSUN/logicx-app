import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('release_init', Path(__file__).resolve().parents[1] / '.container/release_init.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConfigurationTests(unittest.TestCase):
    def values(self):
        return dict(site='logicx.localhost', database='logicx_app', db_user='logicx_app', db_password='test-only', admin_password='test-only', admin_email='admin@tenant.com', redis_password='a:b@c')

    def test_credentials_are_encoded_and_redis_is_app_local(self):
        config = module.configuration(self.values())
        self.assertEqual(config['redis_cache'], 'redis://:a%3Ab%40c@redis-cache:6379/0')
        self.assertNotEqual(config['redis_cache'], config['redis_queue'])
        self.assertFalse(config['developer_mode'])
        self.assertNotIn('admin_password', config)

    def test_foreign_database_and_missing_secret_are_rejected(self):
        values = self.values()
        values['database'] = 'platform'
        with self.assertRaises(ValueError):
            module.configuration(values)
        values = self.values()
        del values['db_password']
        with self.assertRaises(ValueError):
            module.configuration(values)
