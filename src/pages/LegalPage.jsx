import { useState } from 'react';

const PRIVACY_POLICY = `**Last updated: 01/06/2026**

## 1. Introduction

Welcome to PREPARATORIA MONTES DE OCA. We value your privacy and are committed to protecting your personal information.

This Privacy Policy explains how we collect, use, store, and protect your information when you use our educational platform and related services.

By using the platform, you agree to the collection and use of information in accordance with this policy.

---

## 2. Information We Collect

### Personal Information
- Full name
- Email address
- Student or teacher account information
- Profile information

### Educational Data
- Course progress
- Lesson activity
- Quiz and exam results
- Final exam attempts
- Learning analytics

### Technical Information
- Device type
- Browser information
- IP address
- Session logs
- Platform usage data

---

## 3. How We Use Information

We use collected information to:
- Provide educational services
- Manage student accounts
- Track academic progress
- Generate reports and analytics
- Improve platform performance
- Provide technical support
- Prevent fraud or unauthorized access
- Ensure exam integrity and platform security

---

## 4. Online Exams and Assessments

The platform may store:
- Exam responses
- Submission timestamps
- Autosave records
- Session recovery data
- Final grades and scoring information

This information is used exclusively for academic and operational purposes.

---

## 5. Data Storage and Security

We implement reasonable technical and organizational measures to protect user data against unauthorized access, data loss, misuse, alteration, and disclosure.

However, no online platform can guarantee absolute security.

---

## 6. Sharing of Information

We do not sell personal information.

Information may only be shared:
- With authorized educational staff
- When required by law
- To protect platform security and integrity
- With trusted service providers supporting platform operations

---

## 7. User Rights

Users may request:
- Access to personal data
- Correction of inaccurate information
- Deletion of personal data where applicable
- Account deactivation

Requests may be submitted through the platform administration.

---

## 8. Cookies and Tracking

The platform may use cookies or local storage technologies to maintain sessions, save progress, improve user experience, and support online exam recovery systems.

---

## 9. Children's Privacy

The platform is intended for educational use. Educational institutions and guardians are responsible for supervising student access where required by applicable law.

---

## 10. Changes to This Policy

We may update this Privacy Policy periodically. Changes will become effective once published on the platform.

---

## 11. Contact Information

If you have questions about this Privacy Policy, please contact:

**info@prepamontesdeoca.com**

PREPARATORIA MONTES DE OCA`;

const TERMS_OF_SERVICE = `**Last updated: 06/01/2026**

## 1. Acceptance of Terms

By accessing or using PREPARATORIA MONTES DE OCA, you agree to comply with these Terms of Service.

If you do not agree with these terms, you should not use the platform.

---

## 2. Educational Purpose

The platform is intended exclusively for educational and academic use. Users agree to use the platform responsibly and ethically.

---

## 3. User Accounts

Users are responsible for:
- Maintaining account confidentiality
- Protecting login credentials
- All activities performed under their account

The platform may suspend accounts involved in fraudulent activity, academic dishonesty, unauthorized access, or abuse of the system.

---

## 4. Online Exams and Academic Integrity

Users agree:
- Not to share exam content
- Not to impersonate another user
- Not to manipulate exam systems
- Not to use unauthorized methods during evaluations

The platform may record session activity, submission timestamps, exam progress, and attempt history.

Violations may result in invalidated exams, account suspension, or administrative review.

---

## 5. Intellectual Property

All platform content including lessons, activities, exams, graphics, software, and educational materials belongs to PREPARATORIA MONTES DE OCA or its licensors unless otherwise stated.

Unauthorized reproduction or distribution is prohibited.

---

## 6. Platform Availability

We strive to maintain platform availability, but we do not guarantee uninterrupted access. The platform may experience maintenance periods, technical failures, or temporary interruptions.

---

## 7. Limitation of Liability

PREPARATORIA MONTES DE OCA shall not be liable for data loss, service interruptions, user device issues, internet connectivity problems, or unauthorized account access caused by user negligence.

---

## 8. User Conduct

Users must not:
- Attempt to hack or disrupt the platform
- Upload malicious software
- Access unauthorized data
- Use the platform for illegal purposes

---

## 9. Termination

We reserve the right to suspend or terminate access for violations of these Terms.

---

## 10. Modifications to Terms

We may update these Terms of Service periodically. Continued use of the platform after updates constitutes acceptance of the revised terms.

---

## 11. Governing Law

These Terms shall be governed by applicable laws of the corresponding jurisdiction where the educational service operates.

---

## 12. Contact

For questions regarding these Terms, contact:

**info@prepamontesdeoca.com**

PREPARATORIA MONTES DE OCA`;

function renderContent(text) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return <h2 key={i} className="text-xl font-bold text-gray-800 mt-8 mb-3">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('### ')) {
      return <h3 key={i} className="text-base font-semibold text-gray-700 mt-5 mb-2">{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('- ')) {
      return <li key={i} className="ml-5 text-gray-600 list-disc">{line.replace('- ', '')}</li>;
    }
    if (line === '---') {
      return <hr key={i} className="border-gray-200 my-6" />;
    }
    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }
    // Bold text inline
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-gray-600 leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="text-gray-800">{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

export default function LegalPage() {
  const [tab, setTab] = useState('privacy');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">Preparatoria Montes de Oca</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab('privacy')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'privacy'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'terms'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Terms of Service
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {tab === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
          </h1>
          <div className="space-y-1 mt-6">
            {renderContent(tab === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE)}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} Preparatoria Montes de Oca · info@prepamontesdeoca.com
        </p>
      </div>
    </div>
  );
}