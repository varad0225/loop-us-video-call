const socket = io();

// UI Elements
const dashboardScreen = document.getElementById('dashboard-screen');
const callScreen = document.getElementById('call-screen');
const searchUsername = document.getElementById('search-username');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const contactsGrid = document.getElementById('contacts-grid');
const requestsList = document.getElementById('requests-list');
const requestsSection = document.getElementById('requests-section');

const displayRoomId = document.getElementById('display-room-id');
const copyBtn = document.getElementById('copy-btn');
const statusIndicator = document.getElementById('status-indicator');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const toggleAudioBtn = document.getElementById('toggle-audio');
const toggleVideoBtn = document.getElementById('toggle-video');
const endCallBtn = document.getElementById('end-call-btn');

// Modals
const waitingModal = document.getElementById('waiting-modal');
const requestModal = document.getElementById('request-modal');
const cancelRequestBtn = document.getElementById('cancel-request-btn');

const incomingCallModal = document.getElementById('incoming-call-modal');
const outgoingCallModal = document.getElementById('outgoing-call-modal');
const acceptCallBtn = document.getElementById('accept-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');
const cancelCallBtn = document.getElementById('cancel-call-btn');
const incomingCallerName = document.getElementById('incoming-caller-name');

// State
let localStream;
let peerConnection;
let currentRoomId = null;
let isAudioMuted = false;
let isVideoPaused = false;
let isLeaver = false;

// STUN Servers for WebRTC
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- AUDIO SYSTEM (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol=0.5) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playChime() {
    playTone(880, 'sine', 1.5, 0.3); // A5
    setTimeout(() => playTone(1108.73, 'sine', 2.0, 0.3), 150); // C#6
    setTimeout(() => playTone(1318.51, 'sine', 2.5, 0.3), 300); // E6
}

function playSparkle() {
    const el = document.getElementById('sfx-sparkle');
    if (el && el.src) {
        el.currentTime = 0;
        el.play().catch(e => console.log('Audio play failed', e));
    } else {
        // Fallback
        for(let i=0; i<15; i++) {
            setTimeout(() => playTone(2000 + Math.random()*3000, 'sine', 0.1, 0.1), i*40);
        }
    }
}

function playWhoosh() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 2);
    
    gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 1);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 2);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 2);
}

// --- PROFILE EDIT LOGIC ---
const editProfileBtn = document.getElementById('edit-profile-btn');
const editProfileModal = document.getElementById('edit-profile-modal');
const closeProfileBtn = document.getElementById('close-profile-btn');
const profilePicUpload = document.getElementById('profile-pic-upload');
const profileEditAvatar = document.getElementById('profile-edit-avatar');
const editProfileName = document.getElementById('edit-profile-name');
const removePhotoBtn = document.getElementById('remove-photo-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');

let tempProfilePic = null;

if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
        tempProfilePic = window.currentUser.profilePic;
        editProfileName.value = window.currentUser.name;
        renderAvatar(profileEditAvatar, window.currentUser.name, tempProfilePic);
        editProfileModal.classList.remove('hidden');
    });
}

if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', () => editProfileModal.classList.add('hidden'));
}

if (profilePicUpload) {
    profilePicUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                tempProfilePic = e.target.result;
                renderAvatar(profileEditAvatar, window.currentUser.name, tempProfilePic);
            };
            reader.readAsDataURL(file);
        }
    });
}

if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
        tempProfilePic = null;
        profilePicUpload.value = '';
        renderAvatar(profileEditAvatar, window.currentUser.name, tempProfilePic);
    });
}

if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        saveProfileBtn.textContent = 'Saving...';
        saveProfileBtn.disabled = true;
        try {
            const res = await fetch('/api/me/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editProfileName.value, profilePic: tempProfilePic })
            });
            if (res.ok) {
                const data = await res.json();
                window.currentUser = data.user;
                editProfileModal.classList.add('hidden');
            }
        } catch(err) {
            alert('Failed to save profile');
        } finally {
            saveProfileBtn.textContent = 'Save Changes';
            saveProfileBtn.disabled = false;
        }
    });
}

// Helper to extract initials
function getInitials(name) {
    return name ? name.substring(0, 2).toUpperCase() : '??';
}

function renderAvatar(el, name, profilePic) {
    if (profilePic) {
        el.style.backgroundImage = `url(${profilePic})`;
        el.textContent = '';
        el.classList.add('has-image');
    } else {
        el.style.backgroundImage = '';
        el.textContent = getInitials(name);
        el.classList.remove('has-image');
    }
}

// Contacts System Initialization
window.initDashboard = async function() {
    if (!window.currentUser) return;
    
    // Authenticate socket with backend
    socket.emit('authenticate', window.currentUser.id);
    
    await loadContacts();
};

// Search Logic
let searchTimeout;
searchUsername.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const val = e.target.value.trim();
    
    if (!val) {
        searchResults.classList.add('hidden');
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`/api/contacts/search?username=${encodeURIComponent(val)}`);
            const data = await res.json();
            
            searchResults.innerHTML = '';
            if (data.users.length === 0) {
                searchResults.innerHTML = '<div style="padding: 1rem; color: #94a3b8; text-align: center;">No users found</div>';
            } else {
                data.users.forEach(u => {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `
                        <div class="user-info-row">
                            <div class="avatar">${getInitials(u.name)}</div>
                            <div class="user-details">
                                <span class="name">${u.name}</span>
                                <span class="username">@${u.username}</span>
                            </div>
                        </div>
                        <button class="btn primary glowing" onclick="sendContactRequest('${u._id}')" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">Add</button>
                    `;
                    searchResults.appendChild(div);
                });
            }
            searchResults.classList.remove('hidden');
        } catch(err) {
            console.error('Search error', err);
        }
    }, 500);
});

// Hide search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) {
        searchResults.classList.add('hidden');
    }
});

// Contacts API interactions
window.sendContactRequest = async function(userId) {
    try {
        const res = await fetch('/api/contacts/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverId: userId })
        });
        const data = await res.json();
        if (res.ok) {
            alert('Request sent! 💕');
            searchResults.classList.add('hidden');
            searchUsername.value = '';
        } else {
            alert(data.error);
        }
    } catch(err) {
        alert('Network error');
    }
};

window.respondContactRequest = async function(requestId, action) {
    try {
        const res = await fetch('/api/contacts/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, action })
        });
        if (res.ok) {
            loadContacts();
        }
    } catch (err) {
        console.error(err);
    }
};

async function loadContacts() {
    try {
        const res = await fetch('/api/contacts');
        if (res.ok) {
            const data = await res.json();
            renderRequests(data.requests);
            renderContacts(data.contacts);
        }
    } catch (err) {
        console.error(err);
    }
}

function renderRequests(requests) {
    requestsList.innerHTML = '';
    if (requests.length > 0) {
        requestsSection.classList.remove('hidden');
        requests.forEach(req => {
            const div = document.createElement('div');
            div.className = 'request-item';
            div.innerHTML = `
                <div class="user-info-row">
                    <div class="avatar" id="req-avatar-${req._id}"></div>
                    <div class="user-details">
                        <span class="name">${req.sender.name}</span>
                        <span class="username">wants to connect 💕</span>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn danger" onclick="respondContactRequest('${req._id}', 'reject')" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">X</button>
                    <button class="btn primary glowing" onclick="respondContactRequest('${req._id}', 'accept')" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">Accept</button>
                </div>
            `;
            requestsList.appendChild(div);
            renderAvatar(div.querySelector(`#req-avatar-${req._id}`), req.sender.name, req.sender.profilePic);
        });
    } else {
        requestsSection.classList.add('hidden');
    }
}

function renderContacts(contacts) {
    contactsGrid.innerHTML = '';
    if (contacts.length === 0) {
        contactsGrid.innerHTML = '<p class="subtitle" style="font-size: 0.9rem; text-align: left; opacity: 0.7;">No connections yet. Search above to find someone!</p>';
        return;
    }
    
    contacts.forEach(contact => {
        const card = document.createElement('div');
        card.className = 'contact-card';
        card.innerHTML = `
            <div class="avatar" id="contact-avatar-${contact._id}" style="position: relative;">
                <div class="status-dot" id="status-${contact._id}"></div>
            </div>
            <div class="name">${contact.name}</div>
            <div class="username">@${contact.username}</div>
            <button class="btn primary glowing" onclick="initiateCall('${contact._id}', '${contact.name}', '${contact.profilePic || ''}')">
                <i class="fa-solid fa-video"></i> Call
            </button>
        `;
        contactsGrid.appendChild(card);
        renderAvatar(card.querySelector(`#contact-avatar-${contact._id}`), contact.name, contact.profilePic);
    });
}

// Call Orchestration
let activeOutgoingCallTarget = null;
let activeIncomingCallRoom = null;
let remoteCallerInfo = null;

window.initiateCall = function(targetUserId, targetName, targetProfilePic) {
    const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    activeOutgoingCallTarget = targetUserId;
    
    // Store remote info for cinematic transition
    remoteCallerInfo = { name: targetName, profilePic: targetProfilePic };
    
    socket.emit('call_user', {
        targetUserId,
        roomId,
        callerInfo: { name: window.currentUser.name, username: window.currentUser.username, profilePic: window.currentUser.profilePic }
    });
    
    outgoingCallModal.classList.remove('hidden');
    
    // Auto-join our own room to wait
    joinRoom(roomId);
};

cancelCallBtn.addEventListener('click', () => {
    socket.emit('reject_call', { callerId: activeOutgoingCallTarget });
    outgoingCallModal.classList.add('hidden');
    resetUI();
});

// Cinematic Transition Logic
const cinematicTransition = document.getElementById('cinematic-transition');
const cineCardLocal = document.getElementById('cine-card-local');
const cineCardRemote = document.getElementById('cine-card-remote');
const cineAvatarLocal = document.getElementById('cine-avatar-local');
const cineAvatarRemote = document.getElementById('cine-avatar-remote');
const cineNameLocal = document.getElementById('cine-name-local');
const cineNameRemote = document.getElementById('cine-name-remote');
const cinematicParticles = document.getElementById('cinematic-particles');

async function playCinematicTransition() {
    return new Promise((resolve) => {
        // Setup details
        renderAvatar(cineAvatarLocal, window.currentUser.name, window.currentUser.profilePic);
        cineNameLocal.textContent = "You";
        
        if (remoteCallerInfo) {
            renderAvatar(cineAvatarRemote, remoteCallerInfo.name, remoteCallerInfo.profilePic);
            cineNameRemote.textContent = remoteCallerInfo.name;
        }
        
        cinematicParticles.innerHTML = '';
        cinematicTransition.classList.remove('hidden');
        cinematicTransition.classList.remove('flash');
        cineCardLocal.classList.remove('animate-in', 'merge');
        cineCardRemote.classList.remove('animate-in', 'merge');
        
        // 1. Cards appear
        setTimeout(() => {
            cineCardLocal.classList.add('animate-in');
            cineCardRemote.classList.add('animate-in');
        }, 100);
        
        // 2. Cards merge & audio
        setTimeout(() => {
            cineCardLocal.classList.add('merge');
            cineCardRemote.classList.add('merge');
            setTimeout(playSparkle, 1500); // play slightly before they hit
        }, 1500);
        
        // 3. Eruption & Flash
        setTimeout(() => {
            cinematicTransition.classList.add('flash');
            playWhoosh();
            
            // Create particles
            for(let i=0; i<30; i++) {
                const p = document.createElement('div');
                p.className = 'particle';
                const angle = Math.random() * Math.PI * 2;
                const dist = 100 + Math.random() * 300;
                p.style.setProperty('--tx', `${Math.cos(angle)*dist}px`);
                p.style.setProperty('--ty', `${Math.sin(angle)*dist}px`);
                cinematicParticles.appendChild(p);
            }
        }, 3500);
        
        // 4. Finish
        setTimeout(() => {
            cinematicTransition.classList.add('hidden');
            resolve();
        }, 4500);
    });
}

socket.on('incoming_call', (data) => {
    activeIncomingCallRoom = data.roomId;
    remoteCallerInfo = data.callerInfo;
    incomingCallerName.textContent = data.callerInfo.name;
    incomingCallModal.classList.remove('hidden');
    playChime();
});

socket.on('call_failed', (data) => {
    alert(`Call failed: ${data.reason}`);
    outgoingCallModal.classList.add('hidden');
    resetUI();
});

socket.on('call_rejected', () => {
    alert('Call was declined by the user');
    outgoingCallModal.classList.add('hidden');
    resetUI();
});

acceptCallBtn.addEventListener('click', async () => {
    incomingCallModal.classList.add('hidden');
    if (activeIncomingCallRoom) {
        await playCinematicTransition();
        joinRoom(activeIncomingCallRoom);
    }
});

declineCallBtn.addEventListener('click', () => {
    incomingCallModal.classList.add('hidden');
    // Emitting an event or we can just ignore, the caller will wait and we can optionally send a reject
});

socket.on('call_rejected', () => {
    alert("Call was not answered.");
    outgoingCallModal.classList.add('hidden');
    resetUI();
});

socket.on('contact_online', (userId) => {
    const dot = document.getElementById('status-' + userId);
    if (dot) dot.classList.add('online');
});

socket.on('contact_offline', (userId) => {
    const dot = document.getElementById('status-' + userId);
    if (dot) dot.classList.remove('online');
});

socket.on('new_request', () => { loadContacts(); });
socket.on('request_accepted', () => { loadContacts(); });

copyBtn.addEventListener('click', () => {
    if (currentRoomId) {
        navigator.clipboard.writeText(currentRoomId);
        const icon = copyBtn.querySelector('i');
        icon.className = 'fa-solid fa-check';
        setTimeout(() => { icon.className = 'fa-regular fa-copy'; }, 2000);
    }
});

// Join Room Logic
async function joinRoom(roomId) {
    currentRoomId = roomId;
    displayRoomId.textContent = currentRoomId;
    
    // Switch UI
    dashboardScreen.classList.remove('active');
    dashboardScreen.classList.add('hidden');
    callScreen.classList.remove('hidden');
    callScreen.classList.add('active');

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        socket.emit('join_room', roomId);
    } catch (err) {
        console.error("Error accessing media devices.", err);
        alert("Cannot access camera/microphone.");
        resetUI();
    }
}

// Media Controls
toggleAudioBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioMuted = !isAudioMuted;
        audioTrack.enabled = !isAudioMuted;
        toggleAudioBtn.innerHTML = isAudioMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
        toggleAudioBtn.classList.toggle('disabled', isAudioMuted);
    }
});

toggleVideoBtn.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoPaused = !isVideoPaused;
        videoTrack.enabled = !isVideoPaused;
        toggleVideoBtn.innerHTML = isVideoPaused ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>';
        toggleVideoBtn.classList.toggle('disabled', isVideoPaused);
    }
});

// Mutual End Call Logic
endCallBtn.addEventListener('click', () => {
    isLeaver = true;
    socket.emit('request_end_call', currentRoomId);
    waitingModal.classList.remove('hidden');
});

cancelRequestBtn.addEventListener('click', () => {
    isLeaver = false;
    socket.emit('decline_end_call', currentRoomId); 
    waitingModal.classList.add('hidden');
});



// Socket.io Events

socket.on('user_joined', async () => {
    // A partner joined the call, hide the ringing modal
    outgoingCallModal.classList.add('hidden');
    
    // Trigger cinematic merge animation
    await playCinematicTransition();
    
    console.log("Remote user joined. Initiating connection as Caller.");
    statusIndicator.textContent = 'Connected';
    statusIndicator.className = 'status connected';
    
    // Initiate WebRTC Call
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
        console.log("Remote track received");
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice_candidate', { roomId: currentRoomId, candidate: event.candidate });
        }
    };

    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { roomId: currentRoomId, offer: offer });
    } catch (err) {
        console.error("Error creating offer", err);
    }
});

socket.on('offer', async (offer) => {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(configuration);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            console.log("Remote track received");
            if (!remoteVideo.srcObject) {
                remoteVideo.srcObject = event.streams[0];
            }
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', { roomId: currentRoomId, candidate: event.candidate });
            }
        };
        
        // Process any buffered ICE candidates
        if (window.pendingIceCandidates) {
            window.pendingIceCandidates.forEach(c => peerConnection.addIceCandidate(new RTCIceCandidate(c)));
            window.pendingIceCandidates = [];
        }
    }

    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { roomId: currentRoomId, answer: answer });
        
        statusIndicator.textContent = 'Connected';
        statusIndicator.className = 'status connected';
    } catch (err) {
        console.error("Error handling offer", err);
    }
});

socket.on('answer', async (answer) => {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
        console.error("Error handling answer", err);
    }
});

socket.on('ice_candidate', async (candidate) => {
    try {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
            console.log("Buffering early ICE candidate");
            window.pendingIceCandidates = window.pendingIceCandidates || [];
            window.pendingIceCandidates.push(candidate);
        }
    } catch (err) {
        console.error("Error adding ICE candidate", err);
    }
});

socket.on('user_disconnected', () => {
    statusIndicator.textContent = 'Other user disconnected';
    statusIndicator.className = 'status waiting';
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
});

// Interactive Modal Logic
const interactiveMessages = [
    "Uh oh… someone is trying to escape 👀",
    "They want to leave… but I’m not done loving you 🥺",
    "Breaking news 🚨 escape attempt detected!",
    "Are you really leaving me like this? 😭"
];

const romanticLabels = ["Stay with me 💕", "One more minute 🥺", "Hold me longer 💖", "You’re stuck with me 😌"];
const playfulLabels = ["Not going anywhere 😤", "Denied 😈", "Escape failed 😏", "Try again 😂"];
const allowLabels = ["Fine… go 😒", "I’ll let you go 🥺", "Okay… but come back 💕", "Approved 😔", "Permission granted… sadly 💔", "Mission aborted 💫"];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function spawnParticles(x, y, container) {
    const emojis = ['💔', '🥺', '😭', '🚨', '💖', '✨'];
    for(let i = 0; i < 4; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.textContent = getRandomItem(emojis);
        particle.style.left = (x + (Math.random() * 40 - 20)) + 'px';
        particle.style.top = (y + (Math.random() * 40 - 20)) + 'px';
        container.appendChild(particle);
        setTimeout(() => particle.remove(), 2000);
    }
}

function setupInteractiveModal() {
    const title = document.getElementById('request-modal-title');
    const msg = document.getElementById('request-modal-msg');
    const container = document.getElementById('request-modal-actions');
    
    msg.textContent = getRandomItem(interactiveMessages);
    container.innerHTML = '';
    
    const numButtons = Math.random() > 0.5 ? 3 : 2;
    
    const allowBtn = document.createElement('button');
    allowBtn.className = 'btn danger interactive-btn allow-btn';
    allowBtn.textContent = getRandomItem(allowLabels);
    allowBtn.onclick = () => {
        socket.emit('accept_end_call', currentRoomId);
        requestModal.classList.add('hidden');
    };
    
    const denyLabelsPool = [...romanticLabels, ...playfulLabels];
    denyLabelsPool.sort(() => 0.5 - Math.random());
    
    const buttons = [allowBtn];
    for(let i = 0; i < numButtons - 1; i++) {
        const denyBtn = document.createElement('button');
        denyBtn.className = 'btn secondary interactive-btn deny-btn';
        denyBtn.textContent = denyLabelsPool[i];
        denyBtn.onclick = (e) => {
            const rect = container.getBoundingClientRect();
            spawnParticles(e.clientX - rect.left, e.clientY - rect.top, container);
            setTimeout(() => {
                socket.emit('decline_end_call', currentRoomId);
                requestModal.classList.add('hidden');
            }, 500);
        };
        buttons.push(denyBtn);
    }
    
    buttons.sort(() => 0.5 - Math.random());
    
    buttons.forEach((btn, index) => {
        container.appendChild(btn);
        
        setTimeout(() => {
            const cw = container.clientWidth;
            const ch = container.clientHeight;
            const bw = btn.offsetWidth;
            const bh = btn.offsetHeight;
            
            const rx = Math.random() * Math.max(0, (cw - bw));
            const ry = Math.random() * Math.max(0, (ch - bh));
            
            btn.style.left = rx + 'px';
            btn.style.top = ry + 'px';
            btn.style.animationDelay = (Math.random() * 2) + 's';
            
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const btnCenterX = rect.left + rect.width / 2;
                const btnCenterY = rect.top + rect.height / 2;
                
                const distanceX = e.clientX - btnCenterX;
                const distanceY = e.clientY - btnCenterY;
                const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
                
                const isAllow = btn.classList.contains('allow-btn');
                const triggerDistance = isAllow ? 120 : 60;
                
                if (distance < triggerDistance) {
                    const moveAmount = isAllow ? 150 : 50; 
                    
                    let newLeft = parseFloat(btn.style.left) - (distanceX / distance) * moveAmount;
                    let newTop = parseFloat(btn.style.top) - (distanceY / distance) * moveAmount;
                    
                    if (newLeft < 0) newLeft = Math.random() * cw * 0.3;
                    if (newLeft > cw - rect.width) newLeft = cw - rect.width - Math.random() * cw * 0.3;
                    if (newTop < 0) newTop = Math.random() * ch * 0.3;
                    if (newTop > ch - rect.height) newTop = ch - rect.height - Math.random() * ch * 0.3;
                    
                    btn.style.left = newLeft + 'px';
                    btn.style.top = newTop + 'px';
                }
            });
        }, 50);
    });
}

// Mutual End Call Events Handling
socket.on('end_call_requested', () => {
    setupInteractiveModal();
    requestModal.classList.remove('hidden');
});

socket.on('end_call_declined', () => {
    isLeaver = false;
    waitingModal.classList.add('hidden');
    alert('The other person declined to end the call. Call resumes.');
});

// Game Flow Events
socket.on('challenge_initiated', () => {
    waitingModal.classList.add('hidden');
    document.getElementById('waiting-challenge-modal').classList.remove('hidden');
});

socket.on('select_game_challenge', () => {
    requestModal.classList.add('hidden');
    document.getElementById('game-selection-modal').classList.remove('hidden');
});

document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
        const gameId = card.getAttribute('data-game');
        socket.emit('game_selected', { roomId: currentRoomId, gameId });
        document.getElementById('game-selection-modal').classList.add('hidden');
    });
});

socket.on('start_game', (gameId) => {
    document.getElementById('waiting-challenge-modal').classList.add('hidden');
    GameManager.start(gameId, isLeaver);
});

socket.on('game_action', (action) => {
    GameManager.handleAction(action);
});

socket.on('game_result', (data) => {
    document.getElementById('game-play-modal').classList.add('hidden');
    if (data.isWin) {
        if (isLeaver) {
            document.getElementById('final-confirmation-modal').classList.remove('hidden');
        } else {
            alert('Your partner won the challenge!');
        }
    } else {
        alert('Challenge failed! 😝 Call continues!');
        isLeaver = false;
    }
});

// Final Confirmation Buttons
document.getElementById('final-stay-btn').addEventListener('click', () => {
    document.getElementById('final-confirmation-modal').classList.add('hidden');
    isLeaver = false;
});

document.getElementById('final-end-btn').addEventListener('click', () => {
    socket.emit('final_end_call', currentRoomId);
});

socket.on('call_ended', () => {
    document.getElementById('final-confirmation-modal').classList.add('hidden');
    resetUI();
});

// Helper functions
function resetUI() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    currentRoomId = null;
    
    // Hide all modal overlays completely
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.add('hidden');
    });

    callScreen.classList.remove('active');
    callScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    dashboardScreen.classList.add('active');
    
    statusIndicator.textContent = 'Waiting for someone to join...';
    statusIndicator.className = 'status waiting';
}

// Background Hearts Generator
const bgContainer = document.getElementById('bg-particles-container');
function createBackgroundHeart() {
    if (!bgContainer) return;
    const heart = document.createElement('i');
    heart.className = 'fa-solid fa-heart bg-heart';
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.animationDuration = Math.random() * 10 + 10 + 's';
    heart.style.fontSize = Math.random() * 1 + 1 + 'rem';
    bgContainer.appendChild(heart);
    
    setTimeout(() => {
        heart.remove();
    }, 20000);
}
// Create initial hearts
for(let i=0; i<5; i++) {
    setTimeout(createBackgroundHeart, Math.random() * 2000);
}
setInterval(createBackgroundHeart, 2000);
