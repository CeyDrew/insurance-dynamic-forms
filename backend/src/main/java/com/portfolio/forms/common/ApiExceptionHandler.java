package com.portfolio.forms.common;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.portfolio.forms.common.ApiExceptions.ConflictException;
import com.portfolio.forms.common.ApiExceptions.NotFoundException;
import com.portfolio.forms.common.ApiExceptions.ValidationException;

/** Errors as RFC 9457 problem details; validation errors carry an {@code errors} list. */
@RestControllerAdvice
class ApiExceptionHandler {

	@ExceptionHandler(NotFoundException.class)
	ProblemDetail notFound(NotFoundException ex) {
		return problem(HttpStatus.NOT_FOUND, "Bulunamadı", ex.getMessage());
	}

	@ExceptionHandler(ConflictException.class)
	ProblemDetail conflict(ConflictException ex) {
		return problem(HttpStatus.CONFLICT, "Çakışma", ex.getMessage());
	}

	/** Two requests raced for the same version number or the single draft slot. */
	@ExceptionHandler(DataIntegrityViolationException.class)
	ProblemDetail integrity(DataIntegrityViolationException ex) {
		return problem(HttpStatus.CONFLICT, "Çakışma", "Kayıt aynı anda başka bir istekle değiştirildi, tekrar deneyin.");
	}

	@ExceptionHandler(ValidationException.class)
	ProblemDetail invalid(ValidationException ex) {
		ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Doğrulama hatası", ex.getMessage());
		problem.setProperty("errors", ex.errors());
		return problem;
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		return problem;
	}
}
