import { useEffect, useState } from 'react';
import { getToday, isValidDate, weekDays, months } from '../services/globals';
import Loading from './Loading';
import Day from './Day';
import Error from './Error';
import LeftArrow from '../assets/images/left_arrow.svg';
import RightArrow from '../assets/images/right_arrow.svg';
import DatePicker from 'react-datepicker';
import { useNavigate, useParams } from 'react-router-dom';

import 'react-datepicker/dist/react-datepicker.css';

function Calendar() {
	const [loading, setLoading] = useState(true);
	const [selectedDate, setSelectedDate] = useState(null);
	const [formatedDate, setFormatedDate] = useState(null);
	const navigate = useNavigate();
	const { date } = useParams();

	const formatDate = () => {
		if (selectedDate) {
			const [year, month, day] = selectedDate.split('-');
			const d = new Date(`${selectedDate}T00:00:00.000Z`);
			const weekDay = weekDays[d.getUTCDay()];
			const monthText = months[parseInt(month) - 1];
			setFormatedDate(`${weekDay}, ${day} ${monthText} ${year}`)
		}
	}

	const advanceOneDay = () => {
		const date = new Date(`${selectedDate}T00:00:00.000Z`);
		date.setUTCDate(date.getUTCDate() + 1);
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		const day = String(date.getUTCDate()).padStart(2, '0');
		const newDate = `${year}-${month}-${day}`;
		setSelectedDate(newDate);
		navigate(`/${newDate}`);
	}

	const backOneDay = () => {
		const date = new Date(`${selectedDate}T00:00:00.000Z`);
		date.setUTCDate(date.getUTCDate() - 1);
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		const day = String(date.getUTCDate()).padStart(2, '0');
		const newDate = `${year}-${month}-${day}`;
		setSelectedDate(newDate);
		navigate(`/${newDate}`);
	}

	const changeDate = (date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const newDate = `${year}-${month}-${day}`;
		setSelectedDate(newDate);
		navigate(`/${newDate}`);
	}

	useEffect(() => {
		if (date) {
			setSelectedDate(isValidDate(date) ? date : null);
		} else {
			const today = getToday();
			setSelectedDate(today);
			navigate(`/${today}`);
		}
	}, [date, navigate]);

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

	if (date && !isValidDate(date)) {
		return <Error msg="Invalid date. Use the YYYY-MM-DD format." />;
	}

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
							onSelect={changeDate}
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
