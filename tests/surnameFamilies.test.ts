import test from 'node:test';
import assert from 'node:assert/strict';
import { surnameGroups, surnameForms, surnameSuggestions, setSurnameForms } from '../src/mocks/surnameFamilies.ts';
import type { Person } from '../src/types/index.ts';
const p=(id:string,lastName:string,maidenName='')=>({id,firstName:id,lastName,maidenName} as Person);
test('regular Polish male and female surnames share one family; birth names determine membership',()=>{
 assert.deepEqual(surnameForms('KOWALSKA'),{masculine:'KOWALSKI',feminine:'KOWALSKA'});
 const people=[p('a','Borowski'),p('b','Borowska'),p('c','Borowska','Lis'),p('d','Nowak')];
 const groups=surnameGroups(people);assert.equal(groups.length,3);
 assert.deepEqual(groups.find(g=>g.masculine==='Borowski')?.people.map(p=>p.id),['a','b']);
 assert.deepEqual(surnameForms('Kowalska'),{masculine:'Kowalski',feminine:'Kowalska'});
 assert.deepEqual(surnameForms('Zawadzka'),{masculine:'Zawadzki',feminine:'Zawadzka'});
 assert.deepEqual(surnameForms('Nowak'),{masculine:'Nowak',feminine:'Nowak'});
 assert.equal(surnameGroups([...people,p('e','Borowska')])[0].people.length,3);
});
test('manual forms merge irregular groups, preserve existing spellings and accept future members',()=>{
 const people=[p('a','Kowal'),p('b','Kowalowa')];const initial=surnameGroups(people);
 const defs=setSurnameForms(people,[],initial.find(g=>g.masculine==='Kowal')!.id,'Kowal','Kowalowa');
 const groups=surnameGroups(people,defs);assert.equal(groups.length,1);assert.equal(groups[0].people.length,2);
 const renamed=setSurnameForms(people,defs,groups[0].id,'Kowal','Kowalówna');
 assert.equal(surnameGroups([...people,p('c','Kowalówna')],renamed)[0].people.length,3);
 assert.equal(people[1].lastName,'Kowalowa');
 assert.ok(surnameSuggestions(people,renamed).includes('Kowalówna'));
 assert.ok(surnameSuggestions(people,renamed).includes('Kowalowa'));
});
test('new surname creates a family without definitions; placeholders are not invented families',()=>{
 const people=[p('a','Nowak'),{...p('b','Nieznany'),isPlaceholder:true},p('c','')];
 assert.equal(surnameGroups(people).length,1);
 assert.equal(surnameGroups([...people,p('d','Lis')]).length,2);
 assert.throws(()=>setSurnameForms(people,[],surnameGroups(people)[0].id,' ','Nowak'));
});

test('double surnames join both families without duplicating members of a shared group', () => {
  const anna = p('a', 'Kowalska-Nowak', 'Kowalska');
  const jan = p('b', 'Kowalski-Kowalska');
  const groups = surnameGroups([anna, jan]);
  assert.deepEqual(groups.map(g => [g.masculine, g.people.map(person => person.id)]), [
    ['Kowalski', ['a', 'b']],
    ['Nowak', ['a']],
  ]);
  assert.equal(anna.lastName, 'Kowalska-Nowak');
  assert.deepEqual(surnameGroups([p('c', 'Lis', 'Nowak‑Kowalska')]).map(g => g.masculine), ['Kowalski', 'Nowak']);
});
