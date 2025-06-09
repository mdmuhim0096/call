import React, { useEffect, useRef, useState } from "react";
import { getDatabase, ref, set, onValue, remove, push } from "firebase/database";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyB3-LW70CnKpUpkcnbTuLmX2lpheHrPliI",
  authDomain: "contact-form-2-405610.firebaseapp.com",
  projectId: "contact-form-2-405610",
  storageBucket: "contact-form-2-405610.firebasestorage.app",
  messagingSenderId: "200076844672",
  appId: "1:200076844672:web:daf2b3178791665e88d065",
  measurementId: "G-M7MNNC029J"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function VideoCall() {
  const [callId, setCallId] = useState("");
  const [roomCreated, setRoomCreated] = useState(false);
  const pc = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  useEffect(() => {
    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
        localVideo.current.srcObject = stream;

        remoteStream.current = new MediaStream();
        remoteVideo.current.srcObject = remoteStream.current;
      } catch (err) {
        alert("Could not get media: " + err.message);
      }
    }
    startMedia();
  }, []);

  const createPeerConnection = () => {
    pc.current = new RTCPeerConnection(servers);

    // Add local tracks to peer connection
    localStream.current.getTracks().forEach(track => {
      pc.current.addTrack(track, localStream.current);
    });

    // Add remote tracks to remote stream
    pc.current.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.current.addTrack(track);
      });
    };

    pc.current.onicecandidate = event => {
      if (event.candidate) {
        console.log("Sending ICE candidate:", event.candidate);
        const candidatesRef = ref(database, `calls/${callId}/candidates/${roomCreated ? "offer" : "answer"}`);
        // Push instead of set so multiple candidates are saved
        push(candidatesRef, event.candidate.toJSON());
      }
    };
  };

  const createCall = async () => {
    if (!callId) {
      alert("Please enter a Call ID");
      return;
    }

    createPeerConnection();
    setRoomCreated(true);

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);

    await set(ref(database, `calls/${callId}/offer`), offer);
    console.log("Offer set in DB");

    // Listen for answer
    onValue(ref(database, `calls/${callId}/answer`), async snapshot => {
      const data = snapshot.val();
      if (data && !pc.current.currentRemoteDescription) {
        console.log("Answer received", data);
        const answerDesc = new RTCSessionDescription(data);
        await pc.current.setRemoteDescription(answerDesc);
      }
    });

    // Listen for answer ICE candidates
    onValue(ref(database, `calls/${callId}/candidates/answer`), snapshot => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach(async candidate => {
          try {
            await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("Added ICE candidate from answer");
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        });
      }
    });
  };

  const joinCall = async () => {
    if (!callId) {
      alert("Please enter a Call ID");
      return;
    }

    createPeerConnection();

    const callRef = ref(database, `calls/${callId}`);
    onValue(callRef, async snapshot => {
      const data = snapshot.val();
      if (!data?.offer) return;

      if (!pc.current.currentRemoteDescription) {
        console.log("Offer received", data.offer);
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);

        await set(ref(database, `calls/${callId}/answer`), answer);
        console.log("Answer sent");
      }
    });

    // Listen for offer ICE candidates
    onValue(ref(database, `calls/${callId}/candidates/offer`), snapshot => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach(async candidate => {
          try {
            await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("Added ICE candidate from offer");
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        });
      }
    });
  };

  const hangUp = async () => {
    pc.current?.close();
    await remove(ref(database, `calls/${callId}`));
    setCallId("");
    setRoomCreated(false);
  };

  return (
    <div>
      <h2>WebRTC Video Call</h2>
      <input
        type="text"
        placeholder="Enter Call ID"
        value={callId}
        onChange={e => setCallId(e.target.value)}
      />
      <button onClick={createCall}>Create Call</button>
      <button onClick={joinCall}>Join Call</button>
      <button onClick={hangUp}>Hang Up</button>

      <div>
        <video ref={localVideo} autoPlay muted playsInline style={{ width: 300, marginRight: 10 }} />
        <video ref={remoteVideo} autoPlay playsInline style={{ width: 300 }} />
      </div>
    </div>
  );
}

export default VideoCall;
