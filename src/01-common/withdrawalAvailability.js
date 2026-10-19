const withdrawalAvailability = states => {
    if (states.some(state => state === true))
        return true;

    if (states.length && states.every(state => state === false))
        return false;

    return null;
};

export default withdrawalAvailability;