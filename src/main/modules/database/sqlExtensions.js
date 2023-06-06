import { apiCore } from '..';

function isDbExists() {
  try {
    return apiCore.db.isDbExists({}, true);
  } catch (error) {
    console.error(error);
  }
}

function tableExists() {
  try {
    return apiCore.db.tableExists({}, true);
  } catch (error) {
    console.error(error);
  }
}

export default { isDbExists, tableExists };
