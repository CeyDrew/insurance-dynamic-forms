package com.portfolio.forms.common;

/** Exceptions that map to HTTP responses in {@link ApiExceptionHandler}. */
public final class ApiExceptions {

	private ApiExceptions() {
	}

	/** 404. */
	public static class NotFoundException extends RuntimeException {

		public NotFoundException(String message) {
			super(message);
		}
	}

	/** 409: the request is valid but clashes with the current state, e.g. editing a published version. */
	public static class ConflictException extends RuntimeException {

		public ConflictException(String message) {
			super(message);
		}
	}

	/** 400 with a list of field-level problems. */
	public static class ValidationException extends RuntimeException {

		private final transient java.util.List<?> errors;

		public ValidationException(String message, java.util.List<?> errors) {
			super(message);
			this.errors = java.util.List.copyOf(errors);
		}

		public java.util.List<?> errors() {
			return errors;
		}
	}
}
