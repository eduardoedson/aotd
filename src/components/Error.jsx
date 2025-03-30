import Image from '../assets/images/error.png';

function Error ({msg}) {
    return (
        <div className='errorCmp-container'>
            <img src={Image} alt='Something went wrong' />
            <span className='erroCmp-msg'>{msg || 'Oops, something went wrong...'}</span>
        </div>
    )
}

export default  Error;