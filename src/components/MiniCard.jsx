function MiniCard ({ image, text }) {
    return (
        <div className='miniCard-container'>
            <img src={image} alt={text} className='miniCard-image' />
            <span className='miniCard-text'>{text}</span>
        </div>
    )
}

export default MiniCard;