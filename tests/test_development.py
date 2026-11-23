import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    'development_init', Path(__file__).resolve().parents[1] / '.container/init_frappe.py'
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SharedInfrastructureConfiguration(unittest.TestCase):
    def values(self):
        return dict(
            database='logicx_dev', db_user='logicx_dev', site='logicx.localhost',
            redis_user='logicx_dev_test', redis_password='a:b@c',
            redis_cache_db=10, redis_queue_db=11,
        )

    def test_postgres_and_authenticated_shared_redis(self):
        config = module.common_config(self.values())
        self.assertEqual(config['db_type'], 'postgres')
        self.assertEqual(config['db_host'], 'postgres')
        self.assertEqual(config['redis_cache'], 'redis://logicx_dev_test:a%3Ab%40c@redis:6379/10')
        self.assertTrue(config['redis_queue'].endswith('/11'))
        self.assertTrue(config['developer_mode'])

    def test_default_redis_database_and_foreign_sql_identity_are_rejected(self):
        for key, value in [('redis_cache_db', 0), ('redis_queue_db', 0), ('database', 'platform_master')]:
            values = self.values()
            values[key] = value
            with self.assertRaises(ValueError):
                module.common_config(values)
