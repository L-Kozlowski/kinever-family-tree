import pytest
from fastapi.testclient import TestClient
from backend.main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as app:
        yield app


def seed(client,ids,pairs):
    data=dict(revision=0,trees=[dict(id='t',name='Test',people=[dict(id=pid,firstName=pid,lastName='Test') for pid in ids])],connectionsByTree={'t':[dict(id=str(i),source=a,target=b,kind='partner') for i,(a,b) in enumerate(pairs)]})
    assert client.put('/api/state',json=data).status_code==200
    return client.get('/api/state').json()


def remove(client,data,pid):
    data['trees'][0]['people']=[p for p in data['trees'][0]['people'] if p['id']!=pid]
    data['connectionsByTree']['t']=[l for l in data['connectionsByTree']['t'] if pid not in (l['source'],l['target'])]
    return client.put('/api/state',json=data)


def test_bridge_deletion_is_rejected_and_transaction_unchanged(client):
    data=seed(client,['a','b','c','d'],[('a','b'),('b','c'),('c','d')])
    assert remove(client,data,'b').status_code==422
    assert len(client.get('/api/state').json()['trees'][0]['people'])==4
    assert client.get('/api/state').json()['revision']==1


def test_delete_last_connection_is_blocked(client):
    data=seed(client,['a','b'],[('a','b')])
    assert remove(client,data,'a').status_code==422


def test_leaf_and_alternate_paths_can_be_deleted(client):
    data=seed(client,['a','b','c','d'],[('a','b'),('b','c'),('c','a'),('c','d')])
    assert remove(client,data,'b').status_code==200
    data=client.get('/api/state').json()
    assert remove(client,data,'d').status_code==200


def test_single_person_and_preexisting_isolate_can_be_deleted(client):
    data=seed(client,['a','b','c'],[('a','b')])
    assert remove(client,data,'c').status_code==200


def test_last_person_can_be_deleted(client):
    data=seed(client,['a'],[])
    assert remove(client,data,'a').status_code==200
