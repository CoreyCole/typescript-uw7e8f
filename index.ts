///<reference path="RTCPeerConnection.d.ts" />

let audioContext: AudioContext;
let connectionSend: RTCPeerConnection;
let connectionRecv: RTCPeerConnection;

async function getMicStream(): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    navigator.getUserMedia({ audio: true, video: false }, stream => {
      resolve(stream);
    }, err => {
      reject(err);
    });
  });
}

async function startDelayed(muteOriginalStream: boolean) {
  try {
    audioContext = new AudioContext();
    connectionSend = new RTCPeerConnection({});
    connectionRecv = new RTCPeerConnection({});

    const sendStream = await getMicStream();
    connectionSend.addStream(sendStream);

    connectionRecv.onaddstream = (event) => {
      const recvAudio = new Audio();
      recvAudio.srcObject = event.stream.clone();
      recvAudio.autoplay = true;

      recvAudio.onloadedmetadata = () => {

        // controls if original stream should also be played
        // true causes receive track audioLevel == 0
        recvAudio.muted = muteOriginalStream;

        const recvAudioSource = audioContext.createMediaStreamSource(recvAudio.srcObject as MediaStream);
        const delayNode = audioContext.createDelay();
        delayNode.delayTime.value = 1; // delay by 1 second
        recvAudioSource.connect(delayNode);
        delayNode.connect(audioContext.destination);
      };
    };

    connectionSend.onicecandidate = (event) => {
      if (event.candidate) connectionRecv.addIceCandidate(new RTCIceCandidate(event.candidate));
    };

    connectionRecv.onicecandidate = (event) => {
      if (event.candidate) connectionSend.addIceCandidate(new RTCIceCandidate(event.candidate));
    };

    // set connectionSend offer on both connections
    const offer = await connectionSend.createOffer();
    connectionSend.setLocalDescription(offer);
    connectionRecv.setRemoteDescription(offer);

    // set connectionRecv answer on both connections
    const answer = await connectionRecv.createAnswer();
    connectionSend.setRemoteDescription(answer);
    connectionRecv.setLocalDescription(answer);

    setInterval(async () => {
      const stats: RTCStatsReport = await connectionRecv.getStats();
      stats.forEach(report => {
        if (report.type === 'track' && report.id.indexOf('_receiver_') > -1) {
          console.log('audioLevel = ', report.audioLevel)
        }
      });
    }, 1000);
  } catch (err) {
    console.error(err);
  }
}

async function stop() {
  location.reload();
}

document.getElementById('start-both').onclick = () => startDelayed(false);
document.getElementById('start-delayed').onclick = () => startDelayed(true);
document.getElementById('stop').onclick = stop;
