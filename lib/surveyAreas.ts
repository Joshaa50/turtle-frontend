/**
 * Time Table tasks are named after a beach ("Loggos Beach Survey"), but the
 * Morning Survey asks for a survey *area* ("Lepeda"). A volunteer rostered on
 * "Loggos" then has to know that means the Lepeda area. This rewrites a task's
 * leading place name to the survey area of the beach it names, so the two
 * screens use the same words. The stored task name is untouched.
 */
export interface BeachArea {
  name: string;
  survey_area: string;
}

export const surveyAreaTaskLabel = (task: string, beaches: BeachArea[]): string => {
  // Task names are typed into the database by hand, so "Beach Clean up" and
  // "Beach Clean Up" both exist. Show one spelling.
  task = task.replace(/\bclean up\b/gi, 'Clean Up');
  const match = /^(\S+)(\s+Beach\s+Survey.*)$/i.exec(task.trim());
  if (!match || beaches.length === 0) return task;
  const [, place, rest] = match;
  const needle = place.toLowerCase();
  const beach = beaches.find((b) => b.name.toLowerCase().split(/\s+/)[0] === needle);
  if (!beach || !beach.survey_area) return task;
  if (beach.survey_area.toLowerCase() === needle) return task;
  return `${beach.survey_area}${rest}`;
};
