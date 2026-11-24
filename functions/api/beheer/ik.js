import { json } from '../../../src/lib/http.js';
import { ALLERGENEN } from '../../../src/lib/allergenen.js';

export function onRequestGet({ data }) {
  return json({ email: data.beheerder, allergenen: ALLERGENEN });
}
