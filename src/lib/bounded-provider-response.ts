import { HttpError } from './security/http';
export async function boundedProviderResponse(response:Response,limit=4*1024*1024):Promise<unknown> {
  if(Number(response.headers.get('content-length')??0)>limit) throw new HttpError(502,'WHEELCHAIR_RESPONSE_TOO_LARGE','The route response is too large. Choose closer points.');
  const reader=response.body?.getReader();if(!reader)throw new HttpError(502,'WHEELCHAIR_RESPONSE_INVALID','The provider returned an empty response.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new HttpError(502,'WHEELCHAIR_RESPONSE_TOO_LARGE','The route response is too large. Choose closer points.');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new HttpError(502,'WHEELCHAIR_RESPONSE_INVALID','The wheelchair provider returned invalid map data.');}
}
