import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import axios from "axios";

function App() {
    interface Character {
        name: string;
        roundedCritValue: number;
    }

    // const [characterData, setCharacterData] = useState<Character[]>([]);
    // const handleButtonClick = () => {
    //     axios.get("http://localhost:3000/u/").then((response) => {
    //         console.log(response.data);
    //         setCharacterData(response.data);
    //     });
    // };

    // return (
    //     <>
    //         <div className="card">
    //             <button onClick={handleButtonClick}>
    //                 Fetch Character Data
    //             </button>
    //             <ul>
    //                 {characterData.map((character, index) => (
    //                     <li key={index}>
    //                         {character.name}: {character.roundedCritValue}
    //                     </li>
    //                 ))}
    //             </ul>
    //         </div>
    //     </>
    // );

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
