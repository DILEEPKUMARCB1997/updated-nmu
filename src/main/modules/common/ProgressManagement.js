// Definitions by: AlexLin

let progress = {
  SNMP: [],
  anyFault: [],
}

const validProgress = {
  SNMP: ['initialize'],
  anyFault: ['polling'],
}

const isProgressing = (type, progressName) => {
  const tempArray = progress[type];
  return tempArray.includes(progressName);
}

const addProgress = (type, progressName) => {
  // check if progress is valid
  if (!validProgress[type].includes(progressName)) return;
  // check if progress is exist
  if (progress[type].includes(progressName)) return;
  progress = {
    ...progress,
    [type]: [...progress[type], progressName],
  }
}

const removeProgress = (type, progressName) => {
  const tempArray = progress[type];
  // nothing to remove.
  if (!tempArray.includes(progressName)) return;
  tempArray.splice(tempArray.indexOf(progressName), 1);
  progress = {
    ...progress,
    [type]: tempArray,
  }
}

export default { addProgress, removeProgress, isProgressing };