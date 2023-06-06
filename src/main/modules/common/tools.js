// Definitions by: AlexLin

const isArrayEqual = (arr1, arr2) => {

  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;

  arr1.sort();
  arr2.sort();

  arr1.forEach((element, key) => {
    if (element !== arr2[key]) return false;
  });
  return true;
};

export const datePad = date => (`0${date}`).slice(-2);

export default { isArrayEqual };
