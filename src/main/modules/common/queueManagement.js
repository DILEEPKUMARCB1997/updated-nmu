// Add Task Queue ,unshift/psuh
function add(queueArray, data) {
  try {
    if (queueArray === undefined) {
      console.log('queue is undefined');
      return;
    }
    if (data.level === 0) {
      // The unshift() method adds one or more elements to the beginning of an array
      queueArray.unshift(data, (err) => {
        if (err !== undefined) {
          if (err.msg === 'timeout') {
            console.log('queue timeout');
          }
        }
      });
    } else {
      queueArray.push(data, (err) => {
        if (err !== undefined) {
          if (err.msg === 'timeout') {
            console.log('queue timeout');
          }
        }
      });
    }
    // console.warn('queue task count :' + queueArray.length());
  } catch (error) {
    console.error(error);
  }
}

export default { add };
