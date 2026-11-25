import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator


def storage_text(value: str) -> str:
    if "\0" in value:
        raise ValueError("Text cannot contain a null character")
    value.encode("utf-8")
    return value


Text = Annotated[str, AfterValidator(storage_text)]


class SnippetFile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    path: Text
    content: Text

    @field_validator("path")
    @classmethod
    def relative_path(cls, value: str) -> str:
        if re.search(r"[\x00-\x1f\x7f-\x9f]", value):
            raise ValueError("Path contains a control character")
        path = value.strip().replace("\\", "/")
        if (
            len(path) > 255
            or re.match(r"^[a-zA-Z]:", path)
            or any(part in ("", ".", "..") for part in path.split("/"))
        ):
            raise ValueError("Expected a relative file path of at most 255 characters")
        return path

    @field_validator("content")
    @classmethod
    def file_size(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 262144:
            raise ValueError("File exceeds 262144 bytes")
        return value


class CreateSnippet(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Text
    tags: list[Text] = Field(default_factory=list, max_length=10)
    visibility: Literal["public", "unlisted", "private"]
    files: list[SnippetFile] = Field(min_length=1, max_length=20)

    @field_validator("title")
    @classmethod
    def trimmed_title(cls, value: str) -> str:
        title = value.strip()
        if not 1 <= len(title) <= 120:
            raise ValueError("Title must contain 1 to 120 characters")
        return title

    @field_validator("tags")
    @classmethod
    def normalized_tags(cls, values: list[str]) -> list[str]:
        tags = [value.strip().lower() for value in values]
        if any(not 1 <= len(tag) <= 32 for tag in tags):
            raise ValueError("Each tag must contain 1 to 32 characters")
        return list(dict.fromkeys(tags))

    @field_validator("files")
    @classmethod
    def unique_paths(cls, files: list[SnippetFile]) -> list[SnippetFile]:
        if len({file.path for file in files}) != len(files):
            raise ValueError("Duplicate file path")
        return files
