"""Runtime dependency checks executed inside the built application image."""

import unittest


class RuntimeDependenciesTest(unittest.TestCase):
    def test_packaging_version_is_available(self):
        from packaging.version import parse

        self.assertGreater(parse("24.0.0"), parse("1.4.0"))

    def test_gunicorn_loads_gevent_worker(self):
        from gunicorn.util import load_class
        from gunicorn.workers.base import Worker

        worker_class = load_class("gevent")

        self.assertTrue(issubclass(worker_class, Worker))
        self.assertEqual(worker_class.__name__, "GeventWorker")


if __name__ == "__main__":
    unittest.main()
