"""ToolBox dispatcher tests."""
import json

from app.llm.tools import ALL_TOOLS, TOOL_NAMES, ToolBox


def test_all_tools_have_unique_names():
    names = [t["function"]["name"] for t in ALL_TOOLS]
    assert len(names) == len(set(names))
    assert {"book_appointment", "end_call", "opt_out_dnd"} <= set(names)
    assert TOOL_NAMES == set(names)


async def test_dispatch_success():
    box = ToolBox()

    async def handler(args):
        return {"ok": True, "echo": args["x"]}

    box.register("echo", handler)
    result = await box.dispatch("echo", json.dumps({"x": 42}))
    assert result == {"ok": True, "echo": 42}


async def test_dispatch_bad_json():
    box = ToolBox()
    result = await box.dispatch("anything", "{not json")
    assert result["ok"] is False
    assert "Invalid JSON" in result["error"]


async def test_dispatch_unknown_tool():
    box = ToolBox()
    result = await box.dispatch("nonexistent", "{}")
    assert result["ok"] is False
    assert "not available" in result["error"]


async def test_handler_exception_becomes_error_result():
    box = ToolBox()

    async def boom(args):
        raise ValueError("db down")

    box.register("boom", boom)
    result = await box.dispatch("boom", "{}")
    assert result["ok"] is False
    assert "db down" in result["error"]


async def test_non_dict_result_wrapped():
    box = ToolBox()

    async def handler(args):
        return "plain string"

    box.register("h", handler)
    result = await box.dispatch("h", "{}")
    assert result == {"ok": True, "result": "plain string"}
