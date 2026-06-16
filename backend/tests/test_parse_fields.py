from app.parse_fields import parse_fields


def test_parse_basic_fields():
    sample = """
    Approval No: BA/123-2024
    Project: Rainbow Heights
    Owner: John Doe
    Address: 12 Rose Street, Midtown, Visakhapatnam
    Plot dimensions: 30 x 40 ft
    Facing: North
    """

    out = parse_fields(sample)
    assert out.get("approvalNumber") == "BA/123-2024"
    assert "projectName" in out and "Rainbow" in out.get("projectName")
    assert out.get("ownerName")
    assert out.get("siteAddress")
    assert out.get("city") == "Visakhapatnam"
    assert out.get("plotLength") == "30"
    assert out.get("plotWidth") == "40"
