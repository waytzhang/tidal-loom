// Optional local demo capture. No camera, microphone, screen or network access.
export function setupCapture(canvas, simulated) {
  const button=document.createElement('button');
  button.textContent='Record demo';
  button.id='record-demo';
  document.querySelector('.header-actions').append(button);
  const note=document.createElement('p');
  note.className='local-note';
  note.setAttribute('role','status');
  note.textContent='Demo capture records only the game canvas, without audio.';
  document.querySelector('aside').append(note);
  let recorder, stream, chunks=[], started, clock, result;
  button.addEventListener('click',()=>{
    if(recorder?.state==='recording'){recorder.stop();return;}
    if(typeof MediaRecorder==='undefined'||!canvas.captureStream){note.textContent='Canvas recording is unavailable in this browser.';return;}
    try {
      result?.remove();chunks=[];
      stream=canvas.captureStream(30);
      const mimeType=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
      recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:6000000});
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onstop=()=>{
        clearInterval(clock);stream.getTracks().forEach(track=>track.stop());
        const blob=new Blob(chunks,{type:recorder.mimeType});
        const url=URL.createObjectURL(blob);
        result=document.createElement('a');result.href=url;
        result.download=`tidal-loom-${simulated?'iwer':'desktop'}.${recorder.mimeType.includes('mp4')?'mp4':'webm'}`;
        result.textContent='Download recorded demo';result.className='capture-download';
        document.querySelector('aside').append(result);
        result.addEventListener('click',()=>setTimeout(()=>URL.revokeObjectURL(url),60000),{once:true});
        note.textContent=`Recording ready: ${((performance.now()-started)/1000).toFixed(1)} seconds; ${Math.round(blob.size/1024)} KB. ${simulated?'IWER hand simulator; not physical headset footage.':'Desktop play.'}`;
        button.textContent='Record demo';
      };
      recorder.onerror=()=>{clearInterval(clock);stream.getTracks().forEach(track=>track.stop());button.textContent='Record demo';note.textContent='Recording failed; the game still works.';};
      recorder.start(1000);started=performance.now();button.textContent='Stop recording';
      clock=setInterval(()=>{const seconds=Math.floor((performance.now()-started)/1000);note.textContent=`Recording game canvas: ${seconds}s. ${simulated?'IWER hand simulator.':'Desktop play.'}`;if(seconds>=165&&recorder.state==='recording')recorder.stop();},1000);
    } catch(error){stream?.getTracks().forEach(track=>track.stop());button.textContent='Record demo';note.textContent=`Recording unavailable: ${error.name}.`;}
  });
}
