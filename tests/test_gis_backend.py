"""Verification tests for Phase 3 GIS Backend contracts, AST/syntax, and validators."""

from pathlib import Path
import ast
import importlib.util
import sys
import unittest


ROOT_DIR = Path(__file__).resolve().parent.parent


class TestPhase3GISBackendStructure(unittest.TestCase):
    def test_required_directory_tree_exists(self) -> None:
        required_files = [
            "app/main.py",
            "app/core/config.py",
            "app/core/cache.py",
            "app/core/security.py",
            "app/database/base.py",
            "app/database/session.py",
            "app/database/seed.py",
            "app/models/geography.py",
            "app/models/grid.py",
            "app/models/simulation.py",
            "app/models/governance.py",
            "app/models/ai.py",
            "app/models/enterprise.py",
            "app/schemas/common.py",
            "app/schemas/geography.py",
            "app/schemas/asset.py",
            "app/schemas/grid.py",
            "app/schemas/simulation.py",
            "app/schemas/governance.py",
            "app/schemas/ai.py",
            "app/schemas/enterprise.py",
            "app/gis/serializers.py",
            "app/gis/spatial_queries.py",
            "app/ml/__init__.py",
            "app/ml/pipeline.py",
            "app/ml/scheduler.py",
            "app/repositories/geography_repo.py",
            "app/repositories/asset_repo.py",
            "app/repositories/grid_repo.py",
            "app/repositories/simulation_repo.py",
            "app/repositories/governance_repo.py",
            "app/repositories/ai_repo.py",
            "app/services/geography_service.py",
            "app/services/asset_service.py",
            "app/services/grid_service.py",
            "app/services/simulation_service.py",
            "app/services/governance_service.py",
            "app/services/ai_service.py",
            "app/api/deps.py",
            "app/api/routes/auth.py",
            "app/api/routes/geography.py",
            "app/api/routes/assets.py",
            "app/api/routes/grid.py",
            "app/api/routes/search_routes.py",
            "app/api/routes/simulations.py",
            "app/api/routes/governance.py",
            "app/api/routes/ai.py",
            "app/api/routes/enterprise.py",
            "app/api/routes/ws.py",
            "app/utils/validators.py",
            "alembic.ini",
            "alembic/env.py",
            "alembic/versions/20261116_0001_phase3_initial_gis_schema.py",
            "alembic/versions/20261116_0002_phase5_simulations_schema.py",
            "alembic/versions/20261116_0003_phase6_governance_field_ops.py",
            "alembic/versions/20261116_0004_phase7_ai_intelligence.py",
            "alembic/versions/20261121_0005_phase9_enterprise_digital_twin.py",
            "requirements.txt",
            "Dockerfile",
            "docker-compose.yml",
            "docs/GIS_API.md",
            "docs/DEPLOYMENT_GUIDE.md",
            "docs/USER_AND_ADMIN_MANUAL.md",
        ]
        for rel_path in required_files:
            full_path = ROOT_DIR / rel_path
            self.assertTrue(full_path.exists(), f"Missing required file: {rel_path}")

    def test_all_python_files_parse_cleanly(self) -> None:
        py_files = list((ROOT_DIR / "app").rglob("*.py")) + list((ROOT_DIR / "alembic").rglob("*.py"))
        self.assertGreater(len(py_files), 25)
        for path in py_files:
            source = path.read_text(encoding="utf-8")
            ast.parse(source, filename=str(path))

    def test_assets_nearby_route_registered_before_dynamic_asset_id(self) -> None:
        assets_py = (ROOT_DIR / "app/api/routes/assets.py").read_text(encoding="utf-8")
        nearby_pos = assets_py.index('"/nearby"')
        asset_id_pos = assets_py.index('"/{asset_id}"')
        self.assertLess(
            nearby_pos,
            asset_id_pos,
            "/api/assets/nearby must be declared before /api/assets/{asset_id} to avoid route shadowing.",
        )

    def test_simulations_static_routes_before_dynamic_simulation_id(self) -> None:
        sims_py = (ROOT_DIR / "app/api/routes/simulations.py").read_text(encoding="utf-8")
        run_pos = sims_py.index('"/run"')
        compare_pos = sims_py.index('"/compare"')
        dyn_pos = sims_py.index('"/{simulation_id}"')
        self.assertLess(run_pos, dyn_pos, "/simulations/run must precede /{simulation_id}")
        self.assertLess(compare_pos, dyn_pos, "/simulations/compare must precede /{simulation_id}")

    def test_governance_routes_and_rbac_contracts(self) -> None:
        gov_py = (ROOT_DIR / "app/api/routes/governance.py").read_text(encoding="utf-8")
        for route_path in (
            '"/decisions"',
            '"/decisions/{decision_id}"',
            '"/approvals"',
            '"/tasks"',
            '"/tasks/{task_id}"',
            '"/evidence"',
            '"/evidence/{task_id}"',
            '"/audit"',
            '"/notifications"',
            '"/notifications/{notification_id}/read"',
        ):
            self.assertIn(route_path, gov_py, f"Missing governance route {route_path}")
        for role_ref in (
            "UserRole.ADMINISTRATOR",
            "UserRole.CONTROL_ROOM_ENGINEER",
            "UserRole.UTILITY_MANAGER",
            "UserRole.FIELD_ENGINEER",
            "UserRole.VIEWER",
        ):
            self.assertIn(role_ref, gov_py, f"Missing RBAC role {role_ref} in governance routes")

    def test_ai_routes_and_rbac_contracts(self) -> None:
        ai_py = (ROOT_DIR / "app/api/routes/ai.py").read_text(encoding="utf-8")
        for route_path in (
            '"/health"',
            '"/predictions"',
            '"/risk"',
            '"/recommendations"',
            '"/patterns"',
            '"/recalculate"',
        ):
            self.assertIn(route_path, ai_py, f"Missing AI route {route_path}")
        self.assertIn("require_roles(", ai_py)
        self.assertIn("UserRole.CONTROL_ROOM_ENGINEER", ai_py)

    def test_ai_ml_pipeline_execution_and_metrics(self) -> None:
        sys.path.insert(0, str(ROOT_DIR))
        from app.ml.pipeline import run_ai_pipeline

        snapshot = run_ai_pipeline()
        self.assertGreaterEqual(len(snapshot["health_scores"]), 10)
        dtr104 = next((h for h in snapshot["health_scores"] if h["asset_id"] == "DTR-TG-06U-104"), None)
        self.assertIsNotNone(dtr104)
        self.assertEqual(dtr104["health_score"], 42)
        self.assertEqual(dtr104["category"], "CRITICAL")

        metrics = snapshot["model_metrics"]
        for key in ("precision_pct", "recall_pct", "f1_score", "roc_auc", "drift_status"):
            self.assertIn(key, metrics)
        self.assertGreater(metrics["precision_pct"], 50.0)
        self.assertGreater(metrics["roc_auc"], 0.5)

    def test_alembic_phase7_migration_chain(self) -> None:
        mig_py = (ROOT_DIR / "alembic/versions/20261116_0004_phase7_ai_intelligence.py").read_text(encoding="utf-8")
        self.assertIn('revision: str = "20261116_0004"', mig_py)
        self.assertIn('down_revision: Union[str, None] = "20261116_0003"', mig_py)

    def test_postgres_schema_contains_phase5_and_phase6_and_phase7_tables(self) -> None:
        schema_sql = (ROOT_DIR / "docs/POSTGRES_SCHEMA.sql").read_text(encoding="utf-8")
        for table_name in (
            "CREATE TABLE simulations",
            "CREATE TABLE simulation_assets",
            "CREATE TABLE simulation_results",
            "CREATE TABLE decisions",
            "CREATE TABLE approvals",
            "CREATE TABLE field_tasks",
            "CREATE TABLE evidence",
            "CREATE TABLE audit_logs_v2",
            "CREATE TABLE notifications",
            "CREATE TABLE asset_health",
            "CREATE TABLE predictions",
            "CREATE TABLE ai_recommendations",
            "CREATE TABLE grid_risk_indices",
            "CREATE TABLE ai_model_runs",
        ):
            self.assertIn(table_name, schema_sql)
        self.assertIn("'FIELD_ENGINEER'", schema_sql)

    def test_validators_if_shapely_available(self) -> None:
        if importlib.util.find_spec("shapely") is None:
            self.skipTest("shapely not installed in current container Python environment")
        sys.path.insert(0, str(ROOT_DIR))
        from app.utils.validators import (
            validate_bbox_string,
            validate_canonical_id,
            validate_coordinates,
            validate_voltage_level,
        )

        self.assertEqual(validate_coordinates(17.4482, 78.3915), (17.4482, 78.3915))
        with self.assertRaises(ValueError):
            validate_coordinates(95.0, 78.0)

        self.assertEqual(validate_voltage_level("132/33 kV"), "132/33 kV")
        with self.assertRaises(ValueError):
            validate_voltage_level("INVALID_VOLT")

        self.assertEqual(validate_canonical_id("SUB-TG-06U"), "SUB-TG-06U")
        self.assertEqual(
            validate_bbox_string("17.4,78.3,17.5,78.4"),
            (17.4, 78.3, 17.5, 78.4),
        )

    def test_phase8_websocket_monitoring_and_security_routes(self) -> None:
        ws_py = (ROOT_DIR / "app/api/routes/ws.py").read_text(encoding="utf-8")
        self.assertIn('"/ws/grid"', ws_py)
        self.assertIn("GridWebSocketManager", ws_py)

        main_py = (ROOT_DIR / "app/main.py").read_text(encoding="utf-8")
        for endpoint in ('"/health"', '"/api/monitoring/metrics"', "app.include_router(api_router)"):
            self.assertIn(endpoint, main_py)

        auth_py = (ROOT_DIR / "app/api/routes/auth.py").read_text(encoding="utf-8")
        for endpoint in ('"/register"', '"/login"', '"/refresh"', '"/logout"', '"/me"'):
            self.assertIn(endpoint, auth_py)

    def test_phase8_password_hashing_and_refresh_revocation_if_jwt_available(self) -> None:
        if importlib.util.find_spec("jwt") is None or importlib.util.find_spec("pydantic_settings") is None:
            self.skipTest("pyjwt/pydantic-settings not installed in current container Python environment")
        sys.path.insert(0, str(ROOT_DIR))
        from app.core.security import (
            UserRole,
            create_access_token,
            create_refresh_token,
            hash_password,
            revoke_refresh_token,
            verify_access_token,
            verify_password,
            verify_refresh_token,
        )

        hashed = hash_password("GridGuard#2026!")
        self.assertTrue(hashed.startswith("scrypt$"))
        self.assertTrue(verify_password("GridGuard#2026!", hashed))
        self.assertFalse(verify_password("WrongPass!", hashed))

        access_tok = create_access_token("ops.user", UserRole.CONTROL_ROOM_ENGINEER)
        refresh_tok = create_refresh_token("ops.user", UserRole.CONTROL_ROOM_ENGINEER)
        self.assertEqual(verify_access_token(access_tok).role, UserRole.CONTROL_ROOM_ENGINEER)
        self.assertEqual(verify_refresh_token(refresh_tok).sub, "ops.user")
        revoke_refresh_token(refresh_tok)
        with self.assertRaises(Exception):
            verify_refresh_token(refresh_tok)

    def test_phase9_enterprise_digital_twin_routes_and_schema(self) -> None:
        ent_py = (ROOT_DIR / "app/api/routes/enterprise.py").read_text(encoding="utf-8")
        for route_path in (
            '"/digital-twin/network"',
            '"/digital-twin/assets"',
            '"/executive/dashboard"',
            '"/performance"',
            '"/analytics"',
            '"/reports"',
            '"/admin/system-health"',
        ):
            self.assertIn(route_path, ent_py, f"Missing enterprise route {route_path}")

        mig9_py = (
            ROOT_DIR / "alembic/versions/20261121_0005_phase9_enterprise_digital_twin.py"
        ).read_text(encoding="utf-8")
        self.assertIn('revision: str = "20261121_0005"', mig9_py)
        self.assertIn('down_revision: Union[str, None] = "20261116_0004"', mig9_py)

        schema_sql = (ROOT_DIR / "docs/POSTGRES_SCHEMA.sql").read_text(encoding="utf-8")
        for table_name in (
            "CREATE TABLE asset_lifecycle",
            "CREATE TABLE regional_kpis",
            "CREATE TABLE executive_reports",
        ):
            self.assertIn(table_name, schema_sql)

    def test_phase11_live_field_operations_routes_and_schema(self) -> None:
        for rel_path in (
            "app/models/field_ops.py",
            "app/schemas/field_ops.py",
            "app/api/routes/field_ops.py",
            "alembic/versions/20261121_0006_phase11_live_field_operations.py",
        ):
            self.assertTrue((ROOT_DIR / rel_path).exists(), f"Missing Phase 11 file: {rel_path}")

        field_py = (ROOT_DIR / "app/api/routes/field_ops.py").read_text(encoding="utf-8")
        for route_path in (
            '"/location/update"',
            '"/engineers"',
            '"/live-locations"',
            '"/tasks"',
            '"/tasks/{task_id}"',
            '"/tasks/{task_id}/accept"',
            '"/tasks/{task_id}/complete"',
            '"/evidence"',
            '"/routes"',
            '"/dashboard"',
        ):
            self.assertIn(route_path, field_py, f"Missing Phase 11 route {route_path}")
        self.assertIn("require_roles(", field_py)

        mig11_py = (
            ROOT_DIR / "alembic/versions/20261121_0006_phase11_live_field_operations.py"
        ).read_text(encoding="utf-8")
        self.assertIn('revision: str = "20261121_0006"', mig11_py)
        self.assertIn('down_revision: Union[str, None] = "20261121_0005"', mig11_py)

        schema_sql = (ROOT_DIR / "docs/POSTGRES_SCHEMA.sql").read_text(encoding="utf-8")
        for table_name in (
            "CREATE TABLE engineers",
            "CREATE TABLE live_locations",
            "CREATE TABLE geofence_events",
        ):
            self.assertIn(table_name, schema_sql)


if __name__ == "__main__":
    unittest.main()

