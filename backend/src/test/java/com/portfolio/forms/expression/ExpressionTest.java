package com.portfolio.forms.expression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class ExpressionTest {

	private static final LocalDate TODAY = LocalDate.of(2026, 3, 15);

	@Test
	void shortCircuitSkipsTheRightSide() {
		List<String> reads = new ArrayList<>();
		Map<String, Object> values = Map.of("a", false, "b", true);

		Expression.compile("a && b").evaluate(name -> {
			reads.add(name);
			return values.get(name);
		}, TODAY);

		assertThat(reads).containsExactly("a");
	}

	@Test
	void acceptsAnyNumberTypeFromCallers() {
		Map<String, Object> values = Map.of("i", 2, "l", 3L, "d", new java.math.BigDecimal("0.5"));

		assertThat(Expression.compile("i * l + d").evaluate(values, TODAY)).isEqualTo(6.5);
	}

	@Test
	void testAppliesTruthiness() {
		Expression expression = Expression.compile("extras");

		assertThat(expression.test(name -> List.of(), TODAY)).isFalse();
		assertThat(expression.test(name -> List.of("glass"), TODAY)).isTrue();
	}

	@Test
	void neverThrowsWhileEvaluatingOddInput() {
		List<Object> odd = Arrays.asList(null, Double.NaN, Map.of(), List.of(), "x", -0.0, Arrays.asList((Object) null),
				true, 1e308);
		Expression expression = Expression.compile(
				"round(a / b, c) + len(a) - count(b) * daysBetween(a, c) % age(b) || contains(a, b) && !isEmpty(c)"
						+ " || min(a, b) < max(b, c) || a == b || -a > abs(c)");

		for (Object a : odd) {
			for (Object b : odd) {
				for (Object c : odd) {
					Map<String, Object> values = new HashMap<>();
					values.put("a", a);
					values.put("b", b);
					values.put("c", c);
					assertThatNoException().isThrownBy(() -> expression.evaluate(values, TODAY));
				}
			}
		}
	}
}
