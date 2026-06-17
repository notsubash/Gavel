from enum import Enum
from pydantic import BaseModel, Field, ConfigDict, field_validator

class VerdictLabel(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    CONDITIONAL = "CONDITIONAL"

class judgeLabel(str, Enum):
    VC = "vc"
    ENGINEER = "engineer"
    PM = "pm"
    CUSTOMER = "customer"
    COMPETITOR = "competitor"

class Verdict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    judge: judgeLabel
    verdict: VerdictLabel
    roast: str = Field(
        min_length=20, max_length=600,
        description="A sharp 1-3 sentence plain-prose critique. No JSON, no bullet points, no markdown formatting — just sentences."
    )
    score: int = Field(ge=1, le=10, description="A score between 1 and 10 based on the quality of the critique")
    key_concern: str = Field(
        min_length=5, max_length=400,
        description="The single biggest issue with this idea, stated as one clear sentence."
    )

class RoastPanel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    verdicts: list[Verdict]

    @field_validator("verdicts")
    @classmethod
    def must_include_all_judges(cls, verdicts: list[Verdict]) -> list[Verdict]:
        expected = {judge.value for judge in judgeLabel}
        actual = {verdict.judge.value for verdict in verdicts}

        missing = expected - actual
        extra = actual - expected

        if missing or extra or len(verdicts) != len(expected):
            raise ValueError(
                f"Expected exactly one verdict from each judge. "
                f"Missing={missing}, extra={extra}, count={len(verdicts)}, expected={expected}"
            )

        return verdicts

class RoastDebateResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    verdicts: list[Verdict]
    final_synthesis: str = Field(
        min_length=20,
        max_length=5000,
        description="The final moderator synthesis after the judge debate."
    )
    
    @field_validator("verdicts")
    @classmethod
    def must_include_all_judges(cls, verdicts: list[Verdict]) -> list[Verdict]:
        return RoastPanel(verdicts=verdicts).verdicts