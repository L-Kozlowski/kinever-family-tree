import pytest
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.tests.test_api import state


def definition():
    return dict(id='surname:kowal', masculine='Kowal', feminine='Kowalowa', aliases=['Kowal','Kowalowa'])


def test_manual_surname_forms_survive_reopening_and_person_updates(tmp_path):
    data = state()
    data['trees'][0]['surnameFamilies'] = [definition()]
    with TestClient(create_app(tmp_path)) as client:
        assert client.put('/api/state', json=data).status_code == 200
    with TestClient(create_app(tmp_path)) as client:
        saved = client.get('/api/state').json()
        assert saved['trees'][0]['surnameFamilies'] == [definition()]
        saved['trees'][0]['people'][0]['lastName'] = 'Inne nazwisko'
        assert client.put('/api/state', json=saved).status_code == 200
        assert client.get('/api/state').json()['trees'][0]['surnameFamilies'] == [definition()]
        assert client.put('/api/state', json=data).status_code == 409


@pytest.mark.parametrize('invalid', ['empty','overlap','duplicate','oversized'])
def test_invalid_surname_forms_are_rejected_atomically(tmp_path, invalid):
    data=state(); defs=[definition()]
    if invalid == 'empty': defs[0]['masculine']=' '
    elif invalid == 'overlap': defs.append({**definition(),'id':'other','masculine':'Nowak'})
    elif invalid == 'duplicate': defs.append(definition())
    else: defs[0]['aliases']=['x'*501]
    data['trees'][0]['surnameFamilies']=defs
    with TestClient(create_app(tmp_path)) as client:
        assert client.put('/api/state',json=data).status_code == 422
        assert client.get('/api/state').json()['trees'] == []
