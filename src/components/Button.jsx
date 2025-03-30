function Button ({ id, label, fnClick }) {
    return <button id={id} onClick={fnClick}>{label}</button>
}

export default Button;