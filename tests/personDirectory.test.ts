import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryPeople } from '../src/mocks/personDirectory.ts';
import type { Person, DemoConnection } from '../src/types/index.ts';
const person = (id: string, firstName: string, lastName: string, maidenName = '') => ({id, firstName, lastName, maidenName} as Person);
test('directory sorts Polish surnames using maiden names and breaks ties with given names without changing the album', () => {
 const people = [person('z','Anna','Żak'), person('b','Zofia','Kowalska','Borowska'), person('a','Adam','Borowska'), person('l','Ewa','Łuczak')];
 assert.deepEqual(directoryPeople(people, [], '', false).map(p => p.id), ['a','b','l','z']);
 assert.equal(people[0].id, 'z');
 assert.deepEqual(directoryPeople(people, [], 'zofia kowalska', false).map(p => p.id), ['b']);
 assert.deepEqual(directoryPeople(people, [], 'luczak', false).map(p => p.id), ['l']);
});
test('isolated people have no valid relationship in either direction, including adoption and partners', () => {
 const people = ['a','b','c','d','e','f','g'].map(id => person(id, id, 'Test'));
 const connections = [
 {source:'a',target:'b',kind:'parent'}, {source:'c',target:'d',kind:'adoption'}, {source:'e',target:'f',kind:'partner'}, {source:'g',target:'missing',kind:'parent'}
 ] as DemoConnection[];
 assert.deepEqual(directoryPeople(people, connections, '', true).map(p => p.id), ['g']);
 assert.deepEqual(directoryPeople(people, connections, 'a', true), []);
 assert.equal(directoryPeople(people, connections, '', false).length, 7);
});
