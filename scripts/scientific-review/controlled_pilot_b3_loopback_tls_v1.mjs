// B3 TLS acceptance candidate. Loopback + synthetic CA only. NOT a live OpenAI transport.
import https from 'node:https';
import { validateB3OfflineBrokerRequest } from './controlled_pilot_b3_offline_broker_v1.mjs';

export const B3_TLS_LIVE_EGRESS_ENABLED = false;
export const B3_TLS_MOCK_HOST = 'b3-mock-provider.invalid';
const VALID_STAGES = new Set(['count', 'generation']);
const PATHS = Object.freeze({count: '/v1/responses/input_tokens', generation: '/v1/responses'});
const MAX_REPLY_BYTES = 1_000_000;

function deny(code) {throw new Error(`STAGE_5E1G_B3_TLS_${code}`);}

/**
 * Positive HTTPS-path verifier. Both target IP and TLS SNI are fixed to a non-public
 * synthetic test identity. This constructor does not admit public network access,
 * production credentials, client-supplied CA overrides, or environment activation.
 * The caller must supply a short-lived synthetic test CA generated for the test.
 */
export function createB3LoopbackTlsProbe({plan, port, syntheticCaPem} = {}) {
  if (!plan || !Number.isInteger(port) || port < 1 || port > 65535 ||
      typeof syntheticCaPem !== 'string' || syntheticCaPem.length > 20000 ||
      !syntheticCaPem.includes('-----BEGIN CERTIFICATE-----')) {
    deny('INVALID_SYNTHETIC_CONFIGURATION');
  }
  let next = 0;
  let closed = false;
  let attempted = 0;
  return Object.freeze({
    status() {return Object.freeze({mode:'SYNTHETIC_LOOPBACK_ONLY',liveEgressEnabled:false,
      completedOrConsumed:next, attempted, closed});},
    close() {closed=true;},
    async dispatch({request,stage,ordinal}={}) {
      if (closed || next >= 8) deny('CLOSED');
      if (!VALID_STAGES.has(stage) || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4 ||
          stage !== (next<4?'count':'generation') || ordinal !== next%4+1) deny('INVALID_ORDER');
      // Explicitly validate the actual B3 request identity before any I/O.
      validateB3OfflineBrokerRequest(plan,request,stage,ordinal);
      next += 1; // failure is terminal for this ordinal; no implicit retry.
      attempted += 1;
      const len = Buffer.byteLength(request.body,'utf8');
      return new Promise((resolve,reject)=>{
        const client = https.request({
          protocol:'https:',hostname:'127.0.0.1',port,
          servername:B3_TLS_MOCK_HOST,method:'POST',path:PATHS[stage],
          ca:syntheticCaPem,rejectUnauthorized:true,agent:false,
          timeout:2000,
          headers:{'content-type':'application/json', 'content-length':String(len),
            'x-client-request-id':request.headers['x-client-request-id']},
        },response=>{
          if (response.statusCode !== 200 ||
              response.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json' ||
              response.headers.location || response.headers['content-encoding']) {
            response.destroy();reject(new Error('STAGE_5E1G_B3_TLS_HTTP_RESPONSE_REJECTED'));return;
          }
          let size = 0;const chunks=[];
          response.on('data',chunk=>{
            size+=chunk.length;
            if (size>MAX_REPLY_BYTES) {response.destroy();reject(new Error('STAGE_5E1G_B3_TLS_RESPONSE_TOO_LARGE'));}
            else chunks.push(chunk);
          });
          response.on('end',()=>{
            try {
              const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
              if (!result || typeof result !== 'object' || Array.isArray(result))
                deny('INVALID_JSON_RESPONSE');
              resolve(Object.freeze({status:'SYNTHETIC_TLS_OK',requestId:request.headers['x-client-request-id'],result}));
            } catch {reject(new Error('STAGE_5E1G_B3_TLS_INVALID_JSON_RESPONSE'));}
          });
          response.on('error',reject);
        });
        client.on('timeout',()=>client.destroy(new Error('STAGE_5E1G_B3_TLS_TIMEOUT')));
        client.on('error',reject);
        client.end(request.body);
      });
    }
  });
}

export function evaluateB3TlsLiveReadiness(_callerClaims={}) {
  return Object.freeze({
    disposition:'LIVE_NO_GO',
    publicOpenAiTlsValidated:false,
    independentlyEnforcedBrokerEgress:false,
    credentialLifecycleVerified:false,
    ownerLiveAuthorization:false,
    reason:'LOOPBACK_MOCK_TLS_IS_NOT_LIVE_NETWORK_ATTESTATION',
  });
}
