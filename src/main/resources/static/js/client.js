var socketConn = new WebSocket('ws://localhost:8080/socket');
var rtcConn;
var dataChannel;
var msgInput = document.querySelector('#msg-input');
var sendMsgBtn = document.querySelector('#send-msg-btn');

// 채팅창에 들어오면 소켓 연결하고 (세션 생성)
// WebRTC 연결 수행
// - WebRTCPeerConn 생성
// - ICE 모두에게 전달
// - 데이터 채널 생성
// - Offer 모두에게 전달
// -> 이후 다른 사용자들은 Offer 를 받고 Answer 를 전송
// Answer 전송 받으면 WebRTC 를 위한 설정 완료 (?)
// TODO: Answer 받기 전에 Channel 통해서 메시지 전송하면?, 여러 동시성 문제 생각해보기

function setRTCConnection() {
    var configuration = {
        "iceServers": [{ "url": "stun:stun.1.google.com:19302" }]
    };

    rtcConn = new RTCPeerConnection(configuration);
    console.log("[rtc] RTCPeerConnection object create");
    console.log(rtcConn);

    /* ICE 전송 */
    //setup ice handling
    //when the browser finds an ice candidate we send it to another peer
    rtcConn.onicecandidate = function (event) {

        if (event.candidate) {
            send({
                type: "candidate",
                candidate: event.candidate
            });
        }
    };

    /* 데이터 채널 생성 */
    openDataChannel();

    /* Offer 수행 */
    // 다른 사용자들에게 현재 사용자 정보 전송
    rtcConn.createOffer(function (offer) {
        console.log("[rtc] create offer");
        send({
            type: "offer",
            offer: offer
        });

        rtcConn.setLocalDescription(offer);
    }, function (err) {
        console.log("[rtc] send offer error", err);
    });
}

function send(message) {
    socketConn.send(JSON.stringify(message));
}

socketConn.onopen = function () {
    console.log("[websocket] connected");
    setRTCConnection();
};

socketConn.onerror = function (err) {
    console.log("[websocket] got error", err);
};

//handle messages from the server
socketConn.onmessage = function (message) {
    console.log("[websocket] got message", message.data);
    var data = JSON.parse(message.data);

    switch(data.type) {
        case "offer":
            onOffer(data.offer, data.name);
            break;
        case "answer":
            onAnswer(data.answer);
            break;
        case "candidate":
            onCandidate(data.candidate);
            break;
        default:
            break;
    }
};


//when somebody wants to call us
function onOffer(offer, name) {
    connectedUser = name;
    rtcConn.setRemoteDescription(new RTCSessionDescription(offer));

    rtcConn.createAnswer(function (answer) {
        rtcConn.setLocalDescription(answer);

        send({
            type: "answer",
            answer: answer
        });

    }, function (err) {
        console.log("[rtc] receive offer error", err);
    });
}

//when another user answers to our offer
function onAnswer(answer) {
    rtcConn.setRemoteDescription(new RTCSessionDescription(answer));
}

//when we got ice candidate from another user
function onCandidate(candidate) {
    rtcConn.addIceCandidate(new RTCIceCandidate(candidate));
}

//creating data channel
function openDataChannel() {

    var dataChannelOptions = {
        reliable:true
    };

    dataChannel = rtcConn.createDataChannel(dataChannelOptions);
    rtcConn.addEventListener('datachannel', event => {
        dataChannel = event.channel;
    })

    dataChannel.addEventListener('open', event => {
        console.log("[rtc] data channel open");
    });

    dataChannel.addEventListener('close', event => {
        console.log("[rtc] data channel close");
    });

    dataChannel.addEventListener('message', event => {
        console.log("[rtc] data channel receive message: ", event.data);
        $('#chat-msg-div').append(`<div>${event.data}</div><br>`);
    });

    dataChannel.addEventListener('error', event => {
        console.log("[rtc] data channel error", event.error);
    })
}

//when a user clicks the send message button
sendMsgBtn.addEventListener("click", function (event) {
    console.log("[html] input send message btn");
    console.log("[rtc] send message");
    console.log("[rtc] data channel", dataChannel);

    var val = msgInput.value;
    msgInput.value = "";

    dataChannel.send(val);
});