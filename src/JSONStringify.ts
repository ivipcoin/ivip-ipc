const JSONStringify = (obj: any): string => {
	const isArray = (value: any): boolean => {
		return Array.isArray(value) && typeof value === "object";
	};

	const isObject = (value: any): boolean => {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	};

	const isString = (value: any): boolean => {
		return typeof value === "string";
	};

	const isBoolean = (value: any): boolean => {
		return typeof value === "boolean";
	};

	const isNumber = (value: any): boolean => {
		return typeof value === "number";
	};

	const isNull = (value: any): boolean => {
		return value === null && typeof value === "object";
	};

	const isNotNumber = (value: any): boolean => {
		return typeof value === "number" && isNaN(value);
	};

	const isInfinity = (value: any): boolean => {
		return typeof value === "number" && !isFinite(value);
	};

	const isDate = (value: any): boolean => {
		return typeof value === "object" && value !== null && typeof value.getMonth === "function";
	};

	const isUndefined = (value: any): boolean => {
		return value === undefined && typeof value === "undefined";
	};

	const isFunction = (value: any): boolean => {
		return typeof value === "function";
	};

	const isSymbol = (value: any): boolean => {
		return typeof value === "symbol";
	};

	const restOfDataTypes = (value: any): boolean => {
		return isNumber(value) || isString(value) || isBoolean(value);
	};

	const ignoreDataTypes = (value: any): boolean => {
		return isUndefined(value) || isFunction(value) || isSymbol(value);
	};

	const nullDataTypes = (value: any): boolean => {
		return isNotNumber(value) || isInfinity(value) || isNull(value);
	};

	const arrayValuesNullTypes = (value: any): boolean => {
		return isNotNumber(value) || isInfinity(value) || isNull(value) || ignoreDataTypes(value);
	};

	const removeComma = (str: string) => {
		const tempArr = str.split("");
		tempArr.pop();
		return tempArr.join("");
	};

	if (ignoreDataTypes(obj)) {
		return "{}";
	}

	if (isDate(obj)) {
		return `"${obj.toISOString()}"`;
	}

	if (nullDataTypes(obj)) {
		return `${null}`;
	}

	if (isSymbol(obj)) {
		return "{}";
	}

	if (restOfDataTypes(obj)) {
		return JSON.stringify(obj);
	}

	if (isArray(obj)) {
		let arrStr = "";
		obj.forEach((eachValue: any) => {
			arrStr += arrayValuesNullTypes(eachValue) ? JSONStringify(null) : JSONStringify(eachValue);
			arrStr += ",";
		});

		return `[` + removeComma(arrStr) + `]`;
	}

	if (isObject(obj)) {
		let objStr = "";

		const objKeys = Object.keys(obj);

		objKeys.forEach((eachKey) => {
			const eachValue = obj[eachKey];
			objStr += !ignoreDataTypes(eachValue) ? `"${eachKey}":${JSONStringify(eachValue)},` : "";
		});
		return `{` + removeComma(objStr) + `}`;
	}

	return "{}";
};

export default JSONStringify;
