import React, { useEffect, useRef, useState } from "react";
import { database, ref, set, onValue, remove, push } from "./Firebase"; // Adjust if you're exporting differently

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

function VideoCall() {
  const [callId, setCallId] = useState("");
  const [mediaReady, setMediaReady] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);

  const pc = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(new MediaStream());
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  // Initialize camera and mic
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
        localVideo.current.srcObject = stream;
        remoteVideo.current.srcObject = remoteStream.current;
        setMediaReady(true);
      } catch (err) {
        console.error("Media error:", err);
        alert("Please allow camera and mic access.");
      }
    };
    getMedia();
  }, []);

  // Create peer connection
  const createPeerConnection = () => {
    pc.current = new RTCPeerConnection(servers);

    localStream.current.getTracks().forEach(track => {
      pc.current.addTrack(track, localStream.current);
    });

    pc.current.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.current.addTrack(track);
      });
    };

    pc.current.onicecandidate = event => {
      if (event.candidate) {
        const candidatePath = `calls/${callId}/candidates/${roomCreated ? "offer" : "answer"}`;
        const candidateRef = ref(database, candidatePath);
        const newCandidate = push(candidateRef);
        set(newCandidate, event.candidate.toJSON());
      }
    };
  };

  // Create call (offer side)
  const createCall = async () => {
    if (!mediaReady || !callId) return alert("Set call ID and wait for media.");

    createPeerConnection();
    setRoomCreated(true);

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    await set(ref(database, `calls/${callId}/offer`), offer);

    // Listen for answer
    onValue(ref(database, `calls/${callId}/answer`), async snapshot => {
      const data = snapshot.val();
      if (data && !pc.current.currentRemoteDescription) {
        const answerDesc = new RTCSessionDescription(data);
        await pc.current.setRemoteDescription(answerDesc);
      }
    });

    // Listen for remote candidates (answer side)
    onValue(ref(database, `calls/${callId}/candidates/answer`), snapshot => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach(async candidate => {
          await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
        });
      }
    });
  };

  // Join call (answer side)
  const joinCall = async () => {
    if (!mediaReady || !callId) return alert("Set call ID and wait for media.");

    createPeerConnection();

    const callRef = ref(database, `calls/${callId}`);
    onValue(callRef, async snapshot => {
      const data = snapshot.val();
      if (!data?.offer) return;

      await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      await set(ref(database, `calls/${callId}/answer`), answer);
    });

    // Listen for offer ICE candidates
    onValue(ref(database, `calls/${callId}/candidates/offer`), snapshot => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach(async candidate => {
          await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
        });
      }
    });
  };

  // End call
  const hangUp = async () => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }

    await remove(ref(database, `calls/${callId}`));
    setCallId("");
    setRoomCreated(false);
    setMediaReady(false);
    window.location.reload(); // Quick cleanup
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>🔴 WebRTC Video Call</h2>
      <input
        type="text"
        placeholder="Enter Call ID"
        value={callId}
        onChange={e => setCallId(e.target.value)}
        style={{ padding: 8, marginBottom: 10, color: "#fff" }}
      />
      <br />
      <button onClick={createCall} disabled={!mediaReady || !callId}>Create Call</button>
      <button onClick={joinCall} disabled={!mediaReady || !callId}>Join Call</button>
      <button onClick={hangUp}>Hang Up</button>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <video ref={localVideo} autoPlay muted playsInline style={{ width: 300, marginRight: 20 }} />
        <video ref={remoteVideo} autoPlay playsInline style={{ width: 300 }} />
      </div>
    </div>
  );
}

export default VideoCall;
