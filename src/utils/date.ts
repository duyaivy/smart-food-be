const VIETNAM_TIMEZONE_OFFSET_HOURS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const parseDateString = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);

  return {
    year,
    month,
    day
  };
};

export const getVietnamDateRange = (date: string) => {
  const { year, month, day } = parseDateString(date);

  const startDate = new Date(
    Date.UTC(year, month - 1, day, -VIETNAM_TIMEZONE_OFFSET_HOURS, 0, 0, 0)
  );

  const endDate = new Date(startDate.getTime() + MS_PER_DAY);

  return {
    startDate,
    endDate
  };
};

export const formatDateInVietnamTimezone = (date: Date) => {
  const vietnamDate = new Date(date.getTime() + VIETNAM_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);

  return vietnamDate.toISOString().slice(0, 10);
};

export const addDaysToDateString = (date: string, days: number) => {
  const { year, month, day } = parseDateString(date);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));

  return utcDate.toISOString().slice(0, 10);
};

export const getIsoWeekDateRange = (week: string) => {
  const [yearString, weekString] = week.split('-W');
  const year = Number(yearString);
  const weekNumber = Number(weekString);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;

  const firstMondayTime = jan4.getTime() - (jan4Day - 1) * MS_PER_DAY;
  const weekMonday = new Date(firstMondayTime + (weekNumber - 1) * 7 * MS_PER_DAY);

  const weekStartDateString = weekMonday.toISOString().slice(0, 10);
  const weekEndDateString = addDaysToDateString(weekStartDateString, 7);

  return {
    startDateString: weekStartDateString,
    endDateString: weekEndDateString,
    ...getVietnamDateRange(weekStartDateString),
    endDate: getVietnamDateRange(weekEndDateString).startDate
  };
};

export const getWeekDateStrings = (startDateString: string) =>
  Array.from({ length: 7 }, (_, index) => addDaysToDateString(startDateString, index));
