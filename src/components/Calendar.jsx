import { useEffect, useState } from 'react';
import { getToday, weekDays, months } from '../services/globals';
import Loading from './Loading';
import Day from './Day';
import LeftArrow from '../assets/images/left_arrow.svg';
import RightArrow from '../assets/images/right_arrow.svg';
import DatePicker from 'react-datepicker';

import 'react-datepicker/dist/react-datepicker.css';

function Calendar() {
	const [loading, setLoading] = useState(true);
	const [selectedDate, setSelectedDate] = useState(null);
	const [formatedDate, setFormatedDate] = useState(null);

	const formatDate = () => {
		const [year, month, day] = selectedDate.split('-');
		const d = new Date(selectedDate);
		const weekDay = weekDays[d.getDay()];
		const monthText = months[parseInt(month) - 1];
		setFormatedDate(`${weekDay}, ${day} ${monthText} ${year}`)
	}

	const advanceOneDay = () => {
		const date = new Date(selectedDate);
		date.setDate(date.getDate() + 1);
		setSelectedDate(date.toISOString().split('T')[0])
	}

	const backOneDay = () => {
		const date = new Date(selectedDate);
		date.setDate(date.getDate() - 1);
		setSelectedDate(date.toISOString().split('T')[0])
	}

	useEffect(() => {
    	setSelectedDate(getToday());
	}, []);

	useEffect(() => {
		if (selectedDate) {
      		formatDate();
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedDate])

	useEffect(() => {
		if (formatedDate) {
      		setLoading(false);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [formatedDate])

	return (
		<div className="calendar-container">
			{loading ? <Loading /> :
				<>
					<div className="calendar-controllers">
						<img src={LeftArrow} alt="Back one day" className="calendar-controller-leftArrow" onClick={backOneDay} />
						<DatePicker
							// closeOnScroll={true}
							withPortal
							fixedHeight
							todayButton="Go To Today"
							onChange={(date) => setSelectedDate(date.toISOString().split('T')[0])}
							customInput={<span className="calendar-controller-selected">{formatedDate}</span>}
						/>
						<img src={RightArrow} alt="Advance one day" className="calendar-controller-rightArrow" onClick={advanceOneDay} />
					</div>
					<Day date={selectedDate} />
				</>
			}
		</div>
	);
}

export default Calendar;
