import Actor from '@/classes/pongGame/Actor';
import Ball from '@/classes/pongGame/Ball';
import Player from '@/classes/pongGame/Player';
import { socket } from "@/classes/socket";
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react'

export default function Pong() {

    const [lobby, setLobby] = useState(undefined);
    const [isConnected, setIsConnected] = useState(undefined);
    const [gameHasStarted, setGameHasStarted] = useState(false);
    const router = useRouter();

    let context = undefined;
    let canvas = undefined;
    let devicePixelRatio = undefined;

    let playerTurn = "p1";

    const canvasRef = useRef(null);

    const drawBg = () => {
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        // context.fillRect(0, 0, canvas.width * devicePixelRatio, canvas.height * devicePixelRatio);
        context.fill();

    }

    const drawMiddleLine = () => {

        const middle = canvas.width / 2;
        const height = canvas.height;
        const squareSize = 10 * devicePixelRatio;
        const squaresToDraw = height / squareSize / 2 + 1;

        context.fillStyle = "#fff";

        for (let i = 0; i <= squaresToDraw; i++) {
            context.fillRect(middle - (squareSize / 2), i * squareSize + (i * squareSize) - (squareSize / 2), squareSize, squareSize);
            context.fill();
        }
    }

    useEffect(() => {

        // console.log("Q", router.query);

        let lobby = {
            isHost: null,
            host: null,
            lobbyName: null,
            opponent: null
        };

        const recievedLobby = router.query;

        if (recievedLobby === undefined) {
            setLobby(undefined);
            return
        }

        lobby.isHost = recievedLobby.isHost;
        lobby.host = recievedLobby.host;
        lobby.lobbyName = recievedLobby.lobbyName;
        lobby.opponent = recievedLobby.opponent;

        setLobby(lobby)

        // console.log("RL", recievedLobby);
        // console.log("LOBBY:", lobby);

    }, [router.query]);

    useEffect(() => {

        canvas = canvasRef.current;
        context = canvas.getContext("2d");
        devicePixelRatio = window.devicePixelRatio || 1;
        canvas.height = window.innerHeight * devicePixelRatio;
        canvas.width = window.innerWidth * devicePixelRatio;

        let frameCount = 0;
        let animationFrameId;
        let actors = undefined;

        const mouseMoveHandler = (e) => {
            let p = actors.get("p1");

            if (p !== undefined) {
                const speed = Math.abs(p.y - e.y);
                p.speedQueue.enqueue(speed);
                p.updatePos(p.x, e.y);
            }
        }

        canvas.addEventListener("mousemove", mouseMoveHandler);

        function initPong() {
            let player1 = new Player("p1", context, devicePixelRatio, canvas.width * 0.05, context.canvas.height * 0.5);
            let player2 = new Player("p2", context, devicePixelRatio, canvas.width * 0.95, context.canvas.height * 0.5);
            let ball = new Ball(context, canvas.width / 2, canvas.height / 2);

            actors = new Map();
            actors.set("p1", player1);
            actors.set("p2", player2);
            actors.set("ball", ball);

        }

        let ballColor = 0;

        function render() {
            // console.log(e.elapsedTime);
            context.clearRect(0, 0, canvas.width, canvas.height);
            frameCount++;
            drawBg();
            drawMiddleLine();

            // Update Ball new Pos
            let ball = actors.get("ball");
            if (ball !== undefined) {

                if (ball.player === undefined && ball.direction !== null) {
                    const p = ball.direction === true ? "p1" : "p2";
                    // console.log(playerTurn, ball.direction, p);
                    ball.player = actors.get(p);
                }

                if (ball.direction === null) {
                    ball.direction = playerTurn === "p1" ? false : true;
                    ball.setNewDirection();

                } else {
                    ball.updatePos();

                    // RGB
                    // ball.color = ball.color >= 360 ? 0 : ball.color + 1;

                    if (ball.isOutOfBounds()) {
                        const p = ball.direction === true ? "p2" : "p1";
                        playerTurn = playerTurn === "p1" ? "p2" : "p1";
                        actors.get(p).points++;
                        ball.reset();
                        // console.log(actors.get("p1").points, actors.get("p2").points);
                    }



                }

            }

            // Draw actors
            actors.forEach(a => {
                a.draw();
            });

            // Draw Points
            const p1p = actors.get("p1").points;
            const p2p = actors.get("p2").points;

            context.font = "64px serif";
            context.fillStyle = "#fff"
            context.fillText(p1p, canvas.width * 0.4, canvas.height * 0.2);
            context.fillText(p2p, canvas.width * 0.6, canvas.height * 0.2);

            animationFrameId = window.requestAnimationFrame(render);
        }

        initPong();
        render();

        return () => {
            window.cancelAnimationFrame(animationFrameId);
            canvas.removeEventListener("mousemove", mouseMoveHandler)
        }

    }, []);

    useEffect(() => {


        if (lobby === undefined)
            return

        // Socket
        const sessionID = localStorage.getItem("sessionID");
        if (sessionID) {
            socket.auth = { sessionID };
        }


        if (socket.connected === false)
            socket.connect();
        else {
            if (gameHasStarted === false) {
                socket.emit("playerConnected", lobby);
            }
        }


        function EConnected() {
            if (socket.recovered) {
                // any event missed during the disconnection period will be received now
                console.log("Reconnected to server");
            } else {
                console.log("Connected to server");
                // new or unrecoverable session
            }

            console.log("playerConnected");
            socket.emit("playerConnected", lobby);

            // setState("name");
            setIsConnected(socket.connected);
        }

        function ESession(e) {

            const { sessionID, userID, user } = e;
            const { name } = user;
            const serverState = user.state;
            console.log("SS", serverState);
            // console.log(e);
            socket.auth = { sessionID };
            localStorage.setItem("sessionID", sessionID);
            socket.userID = userID;

            console.log("US", name);
            /*
            if (name) {
                socket.username = name;
                setUserName(name);
                setState("mainMenu")
            } else
                setState("name");
            */
        }

        function EDisconnect() {
            setIsConnected(socket.connected);
            // setState("name")
        }

        function EGameCanStart() {
            setGameHasStarted(true);
            console.log("GAME CAN START");
        }

        socket.on("session", ESession);
        socket.on("gameCanStart", EGameCanStart);
        socket.on("disconnect", EDisconnect)
        socket.on("connect", EConnected);

        return () => {
            socket.off("session", ESession);
            socket.off("gameCanStart", EGameCanStart);
            socket.off("disconnect", EDisconnect);
            socket.off("connect", EConnected);
        }

    }, [socket, lobby])

    return (
        <>
            <div style={{ margin: "0", padding: "0", position: "relative" }}>

                {lobby !== undefined ?
                    gameHasStarted === false ?
                        <div style={{
                            position: "absolute",
                            height: "100%", width: "100%",
                            background: "#ffffff80", display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "column"
                        }}> <h1>Waiting for players ...</h1>
                            <div className='loader' />
                        </div>
                        :
                        <>
                            {/* animation start of a game ig */}
                        </>
                    :
                    <></>
                }
                <canvas ref={canvasRef} id="pongGame" width="100%" height="100%" style={{ margin: "0", padding: "0" }}></canvas>
            </div>
        </>
    )
}
