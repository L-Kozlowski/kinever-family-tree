"""HTTP contracts. Genealogical dates remain free text to preserve uncertainty."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)


class Attachment(Contract):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(max_length=200)
    url: str = Field(max_length=200)
    mime: str = Field(max_length=200)
    size: int = Field(ge=0, le=20 * 1024 * 1024)
    caption: str = Field(default='', max_length=10000)


class GeoLocation(Contract):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    label: str = Field(default='', max_length=1000)
    source: Literal['manual','nominatim','gedcom'] = 'manual'


class Person(Contract):
    id: str = Field(min_length=1, max_length=100)
    first_name: str = Field(alias='firstName', min_length=1, max_length=500)
    familiar_name: str = Field(alias='familiarName', default='', max_length=500)
    last_name: str = Field(alias='lastName', default='', max_length=500)
    maiden_name: str = Field(alias='maidenName', default='', max_length=500)
    birth: str = Field(default='', max_length=500)
    death: str = Field(default='', max_length=500)
    birth_place: str = Field(alias='birthPlace', default='', max_length=1000)
    birth_location: GeoLocation | None = Field(alias='birthLocation', default=None)
    residence_location: GeoLocation | None = Field(alias='residenceLocation', default=None)
    residence: str = Field(default='', max_length=1000)
    notes: str = Field(default='', max_length=1000000)
    portrait: int = Field(default=2, ge=0, le=20)
    custom_portrait: bool = Field(alias='customPortrait', default=False)
    photo: str | None = Field(default=None, max_length=200)
    gender: str = Field(default='', max_length=100)
    is_placeholder: bool = Field(alias='isPlaceholder', default=False)
    attachments: list[Attachment] = Field(default_factory=list, max_length=1000)


class Relationship(Contract):
    id: str = Field(min_length=1, max_length=100)
    source: str = Field(min_length=1, max_length=100)
    target: str = Field(min_length=1, max_length=100)
    kind: Literal['parent', 'adoption', 'partner']


class SurnameFamily(Contract):
    id: str = Field(min_length=1, max_length=1000)
    masculine: str = Field(min_length=1, max_length=500)
    feminine: str = Field(min_length=1, max_length=500)
    aliases: list[str] = Field(max_length=2000)

    @model_validator(mode='after')
    def check_names(self):
        if not self.masculine.strip() or not self.feminine.strip() or any(not name.strip() or len(name) > 500 for name in self.aliases):
            raise ValueError('Odmiany nazwiska nie mogą być puste ani dłuższe niż 500 znaków.')
        return self


class Tree(Contract):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=10000)
    updated: str = Field(default='', max_length=100)
    people: list[Person] = Field(default_factory=list)
    surname_families: list[SurnameFamily] = Field(alias='surnameFamilies', default_factory=list, max_length=2000)

    @model_validator(mode='after')
    def check_surname_families(self):
        identifiers, names = set(), {}
        for family in self.surname_families:
            if family.id in identifiers:
                raise ValueError('Powielony identyfikator rodziny.')
            identifiers.add(family.id)
            for value in [family.masculine, family.feminine, *family.aliases]:
                key = ' '.join(value.split()).lower()
                if key in names and names[key] != family.id:
                    raise ValueError('Odmiana nazwiska należy już do innej rodziny.')
                names[key] = family.id
        return self


class State(Contract):
    revision: int = Field(ge=0)
    trees: list[Tree]
    connections_by_tree: dict[str, list[Relationship]] = Field(alias='connectionsByTree')
