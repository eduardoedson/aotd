import Error from './Error';

function Input ({ id, label, value, set, type, options, selectedOption, readOnly }) {
    if (type.toUpperCase() === 'SELECT') {
        return (
            <div className='input-group'>
                <label className='input-group-label' for={id}>{label}</label>
                <select id={id} onChange={(event) => set(event.target.value)} readOnly={readOnly}>
                    {options.map(option => (
                        <option value={option.value} selected={selectedOption === option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        )
    }

    if (type.toUpperCase() === 'TEXT' || type.toUpperCase() === 'PASSWORD') {
        return (
            <div className='input-group'>
                <label className='input-group-label' for={id}>{label}</label>
                <input 
                    id={id}
                    type={type}
                    readOnly={readOnly}
                    value={value}
                    onChange={(event) => set(event.target.value)}
                />
                </div>
        )
    }

    return <Error />
}

export default Input;