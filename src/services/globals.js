export const leftPad = (value, totalWidth, paddingChar = '0') => {
  if (value.toString().length < totalWidth) {
    const length = totalWidth - value.toString().length + 1;
    return Array(length).join(paddingChar) + value;
  }
  return value;
}

export const lastDayMonth = (year, month) => {
  const date = new Date(year, parseInt(month) - 1, 1);

  date.setMonth(date.getMonth() + 1);
  date.setDate(date.getDate() - 1);

  return date.getDate();
}

export const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getDaysMonth = (year, month) => {
  const days = [];
  for (let i = 1; i <= lastDayMonth(year, month); i++) {
    days.push(i);
  }
  return days;
}

export const getToday = () => {
  const day = new Date().getUTCDate();
  const month = new Date().getUTCMonth() + 1;
  const year = new Date().getUTCFullYear();

  return `${year}-${leftPad(month, 2)}-${leftPad(day, 2)}`;
}

export const capitalizeFirstLetter = (str) => {
  return str.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}
