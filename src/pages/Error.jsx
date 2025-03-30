import ErrorCmp from '../components/Error'

function Error ({ msg }) {
    return <div className='error-container'><ErrorCmp msg={msg} /></div>;
}

export default Error;