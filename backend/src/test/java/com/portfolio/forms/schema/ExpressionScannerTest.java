package com.portfolio.forms.schema;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ExpressionScannerTest {

	@Test
	void collectsVariablesAndFunctions() {
		ExpressionScanner.Result result =
				ExpressionScanner.scan("count(chronicConditions) > 0 && !contains(chronicConditions, 'none')");

		assertThat(result.variables()).containsExactlyInAnyOrder("chronicConditions");
		assertThat(result.functions()).containsExactlyInAnyOrder("count", "contains");
	}

	@Test
	void literalsAreNotVariables() {
		ExpressionScanner.Result result = ExpressionScanner.scan("hasLpg == true || brand != null || name == \"a b\"");

		assertThat(result.variables()).containsExactlyInAnyOrder("hasLpg", "brand", "name");
	}

	@Test
	void identifiersInsideStringsAreIgnored() {
		assertThat(ExpressionScanner.scan("fuelType == 'gasoline'").variables()).containsExactly("fuelType");
	}

	@ParameterizedTest
	@CsvSource(delimiter = '|', quoteCharacter = '"', textBlock = """
			currentYear() - modelYear
			round(weightKg / ((heightCm / 100) * (heightCm / 100)), 1)
			-x + 2.5 * (y % 3)
			!(a < -1) && b >= 2
			min(a, max(b, c)) <= abs(-d)
			today()
			""")
	void acceptsValidExpressions(String expression) {
		ExpressionScanner.scan(expression);
	}

	@ParameterizedTest
	@CsvSource(delimiter = '|', quoteCharacter = '"', textBlock = """
			""                 | İfade boş                    | 1
			a ==               | İfade eksik bitiyor          | 5
			a = 1              | '=' yerine '==' kullanın     | 3
			a & b              | '&' yerine '&&' kullanın     | 3
			(a > 1             | Kapanmamış parantez          | 7
			a > 1)             | Fazladan ')'                 | 6
			a b                | arada operatör eksik         | 3
			f(a,)              | Beklenmeyen ')'              | 5
			a , b              | Beklenmeyen ','              | 3
			name == 'abc       | Kapanmamış metin             | 9
			a # b              | Beklenmeyen karakter '#'     | 3
			== a               | Operatörden önce değer       | 1
			""")
	void rejectsInvalidExpressionsWithColumn(String expression, String message, int column) {
		assertThatThrownBy(() -> ExpressionScanner.scan(expression))
			.isInstanceOfSatisfying(ExpressionSyntaxException.class, ex -> {
				assertThat(ex.getMessage()).contains(message);
				assertThat(ex.column()).isEqualTo(column);
			});
	}
}
