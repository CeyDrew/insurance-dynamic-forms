package com.portfolio.forms.submission;

import org.springframework.data.jpa.repository.JpaRepository;

interface SubmissionRepository extends JpaRepository<SubmissionEntity, Long> {
}
