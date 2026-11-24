import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraFor, pinPoints, routeEnds, routeLine } from '../mapView';

const goa = { latitude: 15.5, longitude: 73.8 };
const palolem = { latitude: 15.01, longitude: 74.02 };

test('the camera frames every point as west, south, east, north', () => {
  assert.deepEqual(cameraFor([goa, palolem]), { bounds: [73.8, 15.01, 74.02, 15.5] });
});

test('one point, or points a few metres apart, get a street-level zoom instead of a box', () => {
  assert.deepEqual(cameraFor([goa]), { center: [73.8, 15.5], zoom: 14 });
  const near = cameraFor([goa, { latitude: 15.5005, longitude: 73.8004 }]);
  assert.ok(near && 'zoom' in near && near.zoom === 14);
});

test('no usable points: no map', () => {
  assert.equal(cameraFor([]), null);
  assert.equal(cameraFor([{ latitude: 0, longitude: 0 }, { latitude: NaN, longitude: 3 }, { latitude: 95, longitude: 3 }]), null);
});

test('the route line uses longitude first and needs two points', () => {
  assert.equal(routeLine([goa]), null);
  assert.deepEqual(routeLine([goa, palolem])?.geometry.coordinates, [[73.8, 15.5], [74.02, 15.01]]);
});

test('pins carry their kind and size, moments drawn under the route ends', () => {
  const fc = pinPoints([
    { ...palolem, id: 'end', kind: 'end' },
    { ...goa, id: 'm1', kind: 'moment' },
    { latitude: 0, longitude: 0, id: 'bad', kind: 'moment' },
  ]);
  assert.deepEqual(fc.features.map(f => f.properties?.kind), ['moment', 'end']);
  assert.deepEqual(fc.features.map(f => f.properties?.r), [5, 8]);
});

test('a route has a start pin, and a latest pin once it has two points', () => {
  assert.deepEqual(routeEnds([]), []);
  assert.deepEqual(routeEnds([goa]).map(p => p.kind), ['start']);
  assert.deepEqual(routeEnds([goa, palolem, goa]).map(p => p.kind), ['start', 'end']);
});
