import { json } from '../../../lib/http.js';
import { ALLERGENEN } from '../../../lib/allergenen.js';

export function onRequestGet({ data }) {
  return json({ email: data.beheerder, allergenen: ALLERGENEN });
}
