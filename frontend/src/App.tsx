import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import axios from "axios";

function App() {
    const [message, setMessage] = useState("");
    const handleButtonClick = () => {
        axios.get("http://localhost:3000/").then((data) => {
            console.log(data);
            setMessage("test");
        });
    };

    return (
        <>
            <div className="card">
                <button onClick={() => handleButtonClick()}></button>
                <p>{message}</p>
            </div>
        </>
    );
}

export default App;
