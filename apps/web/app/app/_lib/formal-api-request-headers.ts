import {
  buildFormalRequestHeaders,
  type FormalRequestSession,
} from './formal-request-headers';
import { buildSignedFormalRequestHeaders } from './formal-request-signature';

export function buildFormalApiRequestHeaders(session: FormalRequestSession) {
  return {
    ...buildFormalRequestHeaders(session),
    ...buildSignedFormalRequestHeaders(session),
  };
}
