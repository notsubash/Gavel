from enum import Enum
from typing import Literal 
from pydantic import BaseModel, Field, ConfigDict

class VerdictLabel(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    CONDITIONAL = "CONDITIONAL"

class judgeLabel(str, Enum):
    VC = "vc"

class Verdict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    judge: judgeLabel
    verdict: VerdictLabel
    roast: str = Field(min_length=20, max_length=600, description="A sharp, 1-3 sentence critique of the startup idea")
    score:int = Field(ge=1, le=10, description="A score between 1 and 10 based on the quality of the critique")
    key_concern: str = Field(min_length=5, max_length=250, description="The #1 issue with the startup idea")

