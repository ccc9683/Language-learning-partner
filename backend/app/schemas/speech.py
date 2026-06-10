from pydantic import BaseModel


class SpeechTranscribeResponse(BaseModel):
    text: str
